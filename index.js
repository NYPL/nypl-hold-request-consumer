/* eslint-disable semi */
const NyplStreamsClient = require('@nypl/nypl-streams-client');

exports.kinesisHandler = (records, opts = {}, context) => {
  // TODO: Add Error Handling Class
  if (!opts.schema || opts.schema === '') {
    return null;
  }
  if (!opts.apiUri) {
    return null;
  }

  const schema = opts.schema;
  const apiUri = opts.apiUri;
  const streamsClient = new NyplStreamsClient({ nyplDataApiClientBase: apiUri });
  const decodedKinesisData = streamsClient.decodeData(schema, records.map(i => i.kinesis.data));

  // Resolve the Promise and do something with the decoded data
  return decodedKinesisData
    .then((result) => console.log('result:', result))
    .catch((err) => console.log('rejected:', err));
};

exports.handler = (event, context, callback) => {
  const record = event.Records[0] || {};
  // Handle Kinesis Stream
  if (record.kinesis && record.kinesis.data) {
    exports.kinesisHandler(
      event.Records,
      { schema: 'HoldRequestService', apiUri: 'https://api.nypltech.org/api/v0.1/' },
      context
    );
  }
};
