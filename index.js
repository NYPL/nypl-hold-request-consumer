/* eslint-disable semi */
const NyplStreamsClient = require('@nypl/nypl-streams-client');
const HoldRequestConsumerModel = require('./src/models/HoldRequestConsumerModel');
const HoldRequestConsumerError = require('./src/models/HoldRequestConsumerError');
const ApiServiceHelper = require('./src/helpers/ApiServiceHelper');
const logger = require('./src/helpers/Logger');
const CACHE = {};

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: './config/local.env' });
};

exports.kinesisHandler = (records, opts = {}, context) => {
  const functionName = 'kinesisHandler';

  try {
    if (!opts.schema || opts.schema === '') {
      // Testing Winston Logger
      logger.error('testing logger', { 'jobId': '12345' });
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

    // Required parameters are valid execute the following:
    // 1) Obtain the decoded kinesis data
    // 2) Obtain a valid OAuth token to process record data
    const schema = opts.schema;
    const apiUri = opts.apiUri;
    const streamsClient = new NyplStreamsClient({ nyplDataApiClientBase: apiUri });
    const apiHelper = new ApiServiceHelper(
      process.env.OAUTH_PROVIDER_URL,
      process.env.OAUTH_CLIENT_ID,
      process.env.OAUTH_CLIENT_SECRET,
      process.env.OAUTH_PROVIDER_SCOPE
    );
    const holdRequestConsumerModel = new HoldRequestConsumerModel();

    Promise.all([
      apiHelper.getOAuthToken(CACHE['access_token']),
      streamsClient.decodeData(schema, records.map(i => i.kinesis.data))
    ]).then(result => {
      // The access_token has been obtained and all records have been grouped by source
      // Next, we need create a string from the record and nyplSource keys to perform a GET request
      // to the ItemService
      CACHE['access_token'] = result[0];
      // Save the decoded records to the Model Object
      holdRequestConsumerModel.setRecords(result[1]);

      const groupedRecordsBySource = apiHelper.groupRecordsBy(holdRequestConsumerModel.getRecords(), 'nyplSource');
      const groupedRecordsWithApiUrl = apiHelper.generateRecordApiUrlsArray(groupedRecordsBySource, apiUri);
      console.log(groupedRecordsWithApiUrl);
    })
    .catch(error => {
      console.log('Error from Promise All', error);
    });

  } catch (error) {
    console.log(error);
  }
};

exports.handler = (event, context, callback) => {
  const record = event.Records[0] || {};
  // Handle Kinesis Stream
  if (record.kinesis && record.kinesis.data) {
    exports.kinesisHandler(
      event.Records,
      { schema: '', apiUri: process.env.NYPL_DATA_API_URL },
      context
    );
  }
};
