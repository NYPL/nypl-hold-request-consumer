/* eslint-disable semi */
const NyplStreamsClient = require('@nypl/nypl-streams-client');
const HoldRequestConsumerModel = require('./src/models/HoldRequestConsumerModel');
const HoldRequestConsumerError = require('./src/models/HoldRequestConsumerError');
const ApiServiceHelper = require('./src/helpers/ApiServiceHelper');
const CACHE = {};

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

    const schema = opts.schema;
    const apiUri = opts.apiUri;
    const streamsClient = new NyplStreamsClient({ nyplDataApiClientBase: apiUri });
    const apiHelper = new ApiServiceHelper(
      process.env.OAUTH_PROVIDER_URL,
      process.env.OAUTH_CLIENT_ID,
      process.env.OAUTH_CLIENT_SECRET,
      process.env.OAUTH_PROVIDER_SCOPE
    );
    const hrcModel = new HoldRequestConsumerModel();

    Promise.all([
      apiHelper.getOAuthToken(CACHE['access_token']),
      streamsClient.decodeData(schema, records.map(i => i.kinesis.data))
    ]).then(result => {
      CACHE['access_token'] = result[0];
      // Save the decoded records to the Model Object
      hrcModel.setRecords(result[1]);
      return apiHelper.generateRecordApiUrlsArray(hrcModel.getRecords(), apiUri);
    })
    .then(apiUrlsArray => {
      hrcModel.setApiUrlsArray(apiUrlsArray);
      return apiHelper.processBatchRequest(hrcModel.getApiUrlsArray(), CACHE['access_token'], 'itemApi');
    })
    .then(recordsWithItemData => {
      return hrcModel.mergeRecordsBySourceAndRecordId(hrcModel.getRecords(), recordsWithItemData);
    })
    .then(updatedRecordsWithItemData => {
      hrcModel.setRecords(updatedRecordsWithItemData);
      console.log(hrcModel.getRecords()[0]);
      // return apiHelper.processBatchRequest(hrcModel.getApiUrlsArray(), CACHE['access_token'], 'patronBarcodeApi');
    })
    .then(recordsWithPatronBarcode => {
      // console.log(recordsWithPatronBarcode);
    })
    .catch(error => {
      console.log('PROMISE CHAIN CATCH:', error);
      // Handling Errors From Promise Chain
      if (error.status === 403) {
        // Handle Forbidden Errors
      }

      if (error.status === 401) {
        // Handle OAuth Token refresh
      }
    });
  } catch (error) {
    console.log('CATCH ALL BLOCK:', error);
  }
};

exports.handler = (event, context, callback) => {
  const record = event.Records[0] || {};
  // Handle Kinesis Stream
  if (record.kinesis && record.kinesis.data) {
    exports.kinesisHandler(
      event.Records,
      { schema: 'HoldRequestService', apiUri: process.env.NYPL_DATA_API_URL },
      context
    );
  }
};
