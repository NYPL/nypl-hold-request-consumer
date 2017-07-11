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

    if (!opts.oAuthProviderUrl|| opts.oAuthProviderUrl === '') {
      throw HoldRequestConsumerError({
        message: 'missing oAuthProviderUrl configuration parameter',
        type: 'missing-kinesis-function-parameter',
        function: functionName
      });
    }

    if (!opts.oAuthClientId|| opts.oAuthClientId === '') {
      throw HoldRequestConsumerError({
        message: 'missing oAuthClientId configuration parameter',
        type: 'missing-kinesis-function-parameter',
        function: functionName
      });
    }

    if (!opts.oAuthClientSecret|| opts.oAuthClientSecret === '') {
      throw HoldRequestConsumerError({
        message: 'missing oAuthClientSecret configuration parameter',
        type: 'missing-kinesis-function-parameter',
        function: functionName
      });
    }

    if (!opts.oAuthProviderScope|| opts.oAuthProviderScope === '') {
      throw HoldRequestConsumerError({
        message: 'missing oAuthProviderScope configuration parameter',
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
      opts.oAuthProviderUrl,
      opts.oAuthClientId,
      opts.oAuthClientSecret,
      opts.oAuthProviderScope
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

      return callback(null, 'successfully processed hold request records to SCSB API');
    })
    .catch(error => {
      // Handling Errors From Promise Chain, these errors are non-recoverable (fatal) and must stop the handler from executing
      logger.error('A possible fatal error occured, the Hold Request Consumer Lambda will handle retries based on the error types', { debugInfo: error });

      // Non-recoverable Error: Avro Schema validation failed, do not restart Lambda
      if (error.name === 'AvroValidationError') {
        logger.error(
          'A fatal/non-recoverable AvroValidationError occured which prohibits decoding kinesis stream; Hold Request Consumer Lambda will NOT restart',
          { debugInfo: error.message }
        );
      }

      if (error.name = 'HoldRequestConsumerError') {
        // Recoverable Error: The HoldRequestResult Stream returned an error, will attempt to restart handler.
        if (error.errorType === 'hold-request-result-stream-error') {
          logger.error('restarting the HoldRequestConsumer Lambda; unable to POST data to the HoldRequestResult Stream', { debugInfo: error });
          return callback(error);
        }

        // Recoverable Error: The OAuth Service might be down, will attempt to restart handler.
        if (error.errorType === 'oauth-service-error' && error.errorStatus >= 500) {
          logger.error('restarting the HoldRequestConsumer Lambda; the OAuth service returned a 5xx status code', { debugInfo: error });
          return callback(error);
        }

        // Recoverable Error: The Patron Service might be down, will attempt to restart handler.
        if (error.errorType === 'patron-service-error' && error.errorStatus >= 500) {
          logger.error('restarting the HoldRequestConsumer Lambda; the Patron Service returned a 5xx status code', { debugInfo: error });
          return callback(error);
        }

        // Recoverable Error: The S Service might be down, will attempt to restart handler.
        if (error.errorType === 'service-error' && error.errorStatus >= 500) {
          logger.error('restarting the HoldRequestConsumer Lambda; the Patron Service returned a 5xx status code', { debugInfo: error });
          return callback(error);
        }

        // Recoverable Error: The Item Service might be down, will attempt to restart handler.
        if (error.errorType === 'item-service-error' && error.errorStatus >= 500) {
          logger.error('restarting the HoldRequestConsumer Lambda; the Item Service returned a 5xx status code', { debugInfo: error });
          return callback(error);
        }

        // Recoverable Error: The OAuth Service returned a 200 response however, the access_token was not defined; will attempt to restart handler.
        if (error.errorType === 'empty-access-token-from-oauth-service') {
          logger.error('restarting the HoldRequestConsumer Lambda; the OAuth service returned a 200 response but the access_token value is empty', { debugInfo: error });
          return callback(error);
        }

        // Recoverable Error: OAuth Token expired error
        if (error.errorType === 'access-token-invalid' && error.errorStatus === 401) {
          // Stop the execution of the stream, restart handler.
          logger.error('restarting the HoldRequestConsumer Lambda; OAuth access_token has expired, cannot continue fulfilling NYPL Data API requests', { debugInfo: error });
          logger.info('setting the cached acccess_token to null before Lambda restart');
          CACHE.setAccessToken(null);
          return callback(error);
        }

        // Non-recoverable Error: The permissions scopes are invalid which originate from the .env file
        if (error.errorType === 'access-forbidden-for-scopes' && error.errorStatus === 403) {
          logger.error('restarting the HoldRequestConsumer Lambda; scopes are forbidden, cannot continue fulfilling NYPL Data API requests', { debugInfo: error });
        }
      }
    });
  } catch (error) {
    // Non-recoverable Error: Function arguments are missing from .env file -- cannot begin promise chain without them
    logger.error(
      error.errorMessage,
      { type: error.errorType, function: error.function, debugInfo: error }
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
        scsbApiKey: process.env.SCSB_API_KEY,
        oAuthProviderUrl: process.env.OAUTH_PROVIDER_URL,
        oAuthClientId: process.env.OAUTH_CLIENT_ID,
        oAuthClientSecret: process.env.OAUTH_CLIENT_SECRET,
        oAuthProviderScope: process.env.OAUTH_PROVIDER_SCOPE
      },
      context,
      callback
    );
  }
};
