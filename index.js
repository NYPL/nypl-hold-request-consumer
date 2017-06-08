/* eslint-disable semi */
const avro = require('avsc');

const processRecord = (record, callback) => {
  return Buffer.from(record.kinesis.data, 'base64').toString('utf8');
};

const kinesisStreamHandler = (records, context) => {
  const data = records.map(record => processRecord(record));
  return data;
};

exports.handler = (event, context, callback) => {
  const record = event.Records[0] || {};

  // Handle Kinesis Stream
  if (record.kinesis && record.kinesis.data) {
    const kinesisData = kinesisStreamHandler(event.Records, context);
    console.log('Kinesis Data', kinesisData, typeof kinesisData);
  }
};
