/* eslint-disable semi */
const NyplStreamsClient = require('@nypl/nypl-streams-client');

exports.handler = (event, context, callback) => {
  const record = event.Records[0] || {};
  const streamsClient = new NyplStreamsClient({ nyplDataApiClientBase: 'https://api.nypltech.org/api/v0.1/' });
  // Handle Kinesis Stream
  if (record.kinesis && record.kinesis.data) {
    const decodedKinesisData = streamsClient.decodeData('Bib', event.Records.map(i => i.kinesis.data));

    // Resolve the Promise and do something with the decoded data
    decodedKinesisData
      .then((result) => console.log('result:', result))
      .catch((err) => console.log('rejected:', err));
  }
};
