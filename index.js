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

exports.kinesisHandler = (records, opts = {}, context) => {
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
      logger.info('executing async function call to Item Service for fetching Item data for records');
      return apiHelper.handleHttpAsyncRequests(hrcModel.getRecords(), 'item-service');
    })
    .then(recordsWithItemData => {
      logger.info('storing updated records containing Item data to HoldRequestConsumerModel');
      hrcModel.setRecords(recordsWithItemData);
      logger.info('executing async function call to Patron Service for fetching Patron data for records');
      return apiHelper.handleHttpAsyncRequests(hrcModel.getRecords(), 'patron-barcode-service');
    })
    .then(recordsWithPatronData => {
      logger.info('storing updated records containing Patron data to HoldRequestConsumerModel');
      hrcModel.setRecords(recordsWithPatronData);
      // console.log(hrcModel.getRecords());
      return apiHelper.handleHttpAsyncRequests(hrcModel.getRecords(), 'recap-service');
    })
    .catch(error => {
      logger.error('A fatal error occured with a promise', { error: error });
      // Handling Errors From Promise Chain
      if (error.status === 403) {
        // Handle Forbidden Errors
      }

      if (error.status === 401) {
        // Handle OAuth Token refresh
      }
    });
  } catch (error) {
    logger.error(
      error.message,
      { type: error.type, function: error.function }
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
      context
    );
  }
};
