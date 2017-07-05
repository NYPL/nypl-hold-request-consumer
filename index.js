/* eslint-disable semi */
const NyplStreamsClient = require('@nypl/nypl-streams-client');
const HoldRequestConsumerModel = require('./src/models/HoldRequestConsumerModel');
const HoldRequestConsumerError = require('./src/models/HoldRequestConsumerError');
const ApiServiceHelper = require('./src/helpers/ApiServiceHelper');
const logger = require('./src/helpers/Logger');
const CACHE = require('./src/globals/index');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: './config/local.env' });
};

exports.kinesisHandler = (records, opts = {}, context, callback) => {
  const functionName = 'kinesisHandler';

  try {
    if (!opts.schema || opts.schema === '') {
      throw HoldRequestConsumerError({
        message: 'missing schema name configuration parameter',
        type: 'missing-schema-name-parameter',
        function: functionName
      });
    }

    if (!opts.apiUri || opts.apiUri === '') {
      throw HoldRequestConsumerError({
        message: 'missing apiUri configuration parameter',
        type: 'missing-nypl-data-api-uri',
        function: functionName
      });
    }
    // Store the Schema Name & NYPL Data API Base Url to CACHE
    CACHE.setSchemaName(opts.schema);
    CACHE.setNyplDataApiBase(opts.apiUri);

    const hrcModel = new HoldRequestConsumerModel();
    const streamsClient = new NyplStreamsClient({ nyplDataApiClientBase: CACHE.getNyplDataApiBase() });
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

      logger.info('executing async function call to Item Service to fetch Item data for hold-request records');
      return apiHelper.handleHttpAsyncRequests(hrcModel.getRecords(), 'item-service');
    })
    .then(recordsWithItemData => {
      logger.info('storing updated records containing Item data to HoldRequestConsumerModel');
      hrcModel.setRecords(recordsWithItemData);

      logger.info('executing async function call to Patron Service to fetch Patron data for hold-request records');
      return apiHelper.handleHttpAsyncRequests(hrcModel.getRecords(), 'patron-barcode-service');
    })
    .then(recordsWithPatronData => {
      logger.info('storing updated records containing Patron data to HoldRequestConsumerModel');
      hrcModel.setRecords(recordsWithPatronData);

      console.log(hrcModel.getRecords());
    })
    .catch(error => {
      // Handling Errors From Promise Chain, these errors are non-recoverable and must stop the handler from executing

      // Handle errors from HoldRequestProcessed Stream
      // Occurs when a Hold Request record could not be posted to the Processed Stream
      if (error.errorType === 'hold-request-processed-stream-error') {
        // Stop the execution of the stream, restart handler.
        logger.info('restarting the lambda; unable to POST data to the HoldRequestResult Stream');
      }

      // Handle OAuth Token expired error
      if (error.errorType === 'access-token-invalid' && error.errorStatus === 401) {
        // Stop the execution of the stream, restart handler.
        logger.info('restarting the lambda; OAuth token has expired and cannot continue fulfilling NYPL Data API requests');
        CACHE.setAccessToken(null);
      }

      // return callback(error);
    });
  } catch (error) {
    logger.error(
      error.errorMessage,
      { type: error.errorType, function: error.function }
    );
  }
};

exports.handler = (event, context, callback) => {
  const record = event.Records[0] || {};
  // Handle Kinesis Stream
  if (record.kinesis && record.kinesis.data) {
    exports.kinesisHandler(
      event.Records,
      { schema: 'HoldRequest', apiUri: process.env.NYPL_DATA_API_URL },
      context,
      callback
    );
  }
};
