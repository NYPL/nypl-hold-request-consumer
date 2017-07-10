/* eslint-disable semi */
const NyplStreamsClient = require('@nypl/nypl-streams-client');
const HoldRequestConsumerModel = require('./src/models/HoldRequestConsumerModel');
const HoldRequestConsumerError = require('./src/models/HoldRequestConsumerError');
const ApiServiceHelper = require('./src/helpers/ApiServiceHelper');
const SCSBApiHelper = require('./src/helpers/SCSBApiHelper');
const logger = require('./src/helpers/Logger');
const CACHE = require('./src/globals/index');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: './config/local.env' });
};

exports.kinesisHandler = (records, opts = {}, context, callback) => {
  const functionName = 'kinesisHandler';

  try {
    if (!opts.schemaName || opts.schemaName === '') {
      throw HoldRequestConsumerError({
        message: 'missing schemaName configuration parameter',
        type: 'missing-kinesis-function-parameter',
        function: functionName
      });
    }

    if (!opts.resultStreamName || opts.resultStreamName === '') {
      throw HoldRequestConsumerError({
        message: 'missing resultStreamName configuration parameter',
        type: 'missing-kinesis-function-parameter',
        function: functionName
      });
    }

    if (!opts.nyplDataApiBaseUrl|| opts.nyplDataApiBaseUrl === '') {
      throw HoldRequestConsumerError({
        message: 'missing nyplDataApiBaseUrl configuration parameter',
        type: 'missing-kinesis-function-parameter',
        function: functionName
      });
    }

    if (!opts.scsbApiBaseUrl || opts.scsbApiBaseUrl === '') {
      throw HoldRequestConsumerError({
        message: 'missing scsbApiBaseUrl configuration parameter',
        type: 'missing-kinesis-function-parameter',
        function: functionName
      });
    }

    if (!opts.scsbApiKey|| opts.scsbApiKey === '') {
      throw HoldRequestConsumerError({
        message: 'missing scsbApiKey configuration parameter',
        type: 'missing-kinesis-function-parameter',
        function: functionName
      });
    }

    // Store configuration and ENV variables to global CACHE object
    CACHE.setSchemaName(opts.schemaName);
    CACHE.setResultStreamName(opts.resultStreamName);
    CACHE.setNyplDataApiBaseUrl(opts.nyplDataApiBaseUrl);
    CACHE.setSCSBApiBaseUrl(opts.scsbApiBaseUrl);
    CACHE.setSCSBApiKey(opts.scsbApiKey);

    const hrcModel = new HoldRequestConsumerModel();
    const streamsClient = new NyplStreamsClient({ nyplDataApiClientBase: CACHE.getNyplDataApiBaseUrl() });
    const apiHelper = new ApiServiceHelper(
      process.env.OAUTH_PROVIDER_URL,
      process.env.OAUTH_CLIENT_ID,
      process.env.OAUTH_CLIENT_SECRET,
      process.env.OAUTH_PROVIDER_SCOPE
    );

    Promise.all([
      apiHelper.getTokenFromOAuthService(CACHE.getAccessToken()),
      streamsClient.decodeData(CACHE.getSchemaName(), records.map(i => i.kinesis.data))
    ]).then(result => {
      logger.info('storing access_token in CACHE global');
      CACHE.setAccessToken(result[0]);

      logger.info('storing decoded kinesis records to HoldRequestConsumerModel');
      hrcModel.setRecords(result[1]);

      return apiHelper.handleHttpAsyncRequests(hrcModel.getRecords(), 'item-service');
    })
    .then(recordsWithItemData => {
      logger.info('storing updated records containing Item data to HoldRequestConsumerModel');
      hrcModel.setRecords(recordsWithItemData);

      return apiHelper.handleHttpAsyncRequests(hrcModel.getRecords(), 'patron-barcode-service');
    })
    .then(recordsWithPatronData => {
      logger.info('storing updated records containing Patron data to HoldRequestConsumerModel');
      hrcModel.setRecords(recordsWithPatronData);

      return SCSBApiHelper.handlePostingRecordsToSCSBApi(
        hrcModel.getRecords(),
        CACHE.getSCSBApiBaseUrl(),
        CACHE.getSCSBApiKey()
      );
    })
    .then(resultsOfRecordswithScsbResponse => {
      logger.info('storing updated records containing SCSB API response to HoldRequestConsumerModel');
      hrcModel.setRecords(resultsOfRecordswithScsbResponse);
    })
    .catch(error => {
      // Handling Errors From Promise Chain, these errors are non-recoverable (fatal) and must stop the handler from executing
      logger.error('A fatal error occured, Hold Request Consumer Lambda needs to be restarted', { error: error });

      // Handle Avro Errors which prevents the Lambda from decoding data to process
      if (error.name === 'AvroValidationError') {
        logger.error(
          'restarting the HoldRequestConsumer Lambda; obtained an AvroValidationError which prohibits decoding kinesis stream',
          { error: error.message }
        );
      }

      // Handle errors from HoldRequestProcessed Stream
      // Occurs when a Hold Request record could not be posted to the Results Stream
      if (error.errorType === 'hold-request-results-stream-error') {
        // Stop the execution of the stream, restart handler.
        logger.error('restarting the HoldRequestConsumer Lambda; unable to POST data to the HoldRequestResult Stream');
      }

      // Handle OAuth Token expired error
      if (error.errorType === 'access-token-invalid' && error.errorStatus === 401) {
        // Stop the execution of the stream, restart handler.
        logger.error('restarting the HoldRequestConsumer Lambda; OAuth access_token has expired, cannot continue fulfilling NYPL Data API requests');
        logger.info('setting the cached acccess_token to null before Lambda restart');
        CACHE.setAccessToken(null);
      }

      if (error.errorType === 'access-forbidden-for-scopes' && error.errorStatus === 403) {
        logger.error('restarting the HoldRequestConsumer Lambda; scopes are forbidden, cannot continue fulfilling NYPL Data API requests');
      }

      // return callback(error);
    });
  } catch (error) {
    logger.error(
      error.errorMessage,
      { type: error.errorType, function: error.function, debug: error }
    );
  }
};

exports.handler = (event, context, callback) => {
  const record = event.Records[0] || {};
  // Handle Kinesis Stream
  if (record.kinesis && record.kinesis.data) {
    exports.kinesisHandler(
      event.Records,
      { schemaName: process.env.HOLD_REQUEST_SCHEMA_NAME,
        resultStreamName: process.env.HOLD_REQUEST_RESULT_STREAM_NAME,
        nyplDataApiBaseUrl: process.env.NYPL_DATA_API_URL,
        scsbApiBaseUrl: process.env.SCSB_API_BASE_URL,
        scsbApiKey: process.env.SCSB_API_KEY
      },
      context,
      callback
    );
  }
};
