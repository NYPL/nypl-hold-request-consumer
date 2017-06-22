/* eslint-disable semi */
const NyplStreamsClient = require('@nypl/nypl-streams-client');
const SCSBModel = require('./src/models/SCSBModel');
const ApiServiceHelper = require('./src/helpers/ApiServiceHelper');
const HoldRequestConsumerError = require('./src/models/HoldRequestConsumerError');
const logger = require('./src/helpers/Logger');
const CACHE = {};

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: './config/oauth.env' });
};

exports.kinesisHandler = (records, opts = {}, context) => {
  try {
    if (!opts.schema || opts.schema === '') {
      // Testing Winston Logger
      logger.log('info', 'testing logger', { 'jobId': '12345' });
      throw HoldRequestConsumerError({
        message: 'kinesisHandler(): missing schema name configuration parameter',
        type: 'missing-schema-name-parameter'
      });
    }

    if (!opts.apiUri || opts.apiUri === '') {
      throw HoldRequestConsumerError({
        message: 'kinesisHandler(): missing apiUri configuration parameter',
        type: 'missing-nypl-data-api-uri'
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

    Promise.all([
      apiHelper.getOAuthToken(CACHE['access_token']),
      streamsClient.decodeData(schema, records.map(i => i.kinesis.data))
    ]).then(result => {
      // Both promises were fulfilled
      CACHE['access_token'] = result[0];
      const decodedKinesisData = result[1];

      console.log(decodedKinesisData, CACHE);
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
      { schema: '', apiUri: 'https://api.nypltech.org/api/v0.1/' },
      context
    );
  }
};
