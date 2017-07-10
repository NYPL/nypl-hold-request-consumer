const NyplStreamsClient = require('@nypl/nypl-streams-client');
const CACHE = require('../globals/index');

const ResultStreamHelper = module.exports = {
  postRecordToStream: (obj = {}, streamName = CACHE.getResultStreamName()) => {
    const functionName = 'postRecordToStream';
    const objectToBePosted = {};
    const streamsClient = new NyplStreamsClient({
      nyplDataApiClientBase: CACHE.getNyplDataApiBaseUrl()
    });

    if (!obj.holdRequestId || obj.holdRequestId === '') {
      return HoldRequestConsumerError({
        message: 'the hold request id is not defined for the record, unable to post failed record to stream',
        type: 'undefined-hold-request-id',
        function: functionName
      });
    }

    if (!streamName) {
      return HoldRequestConsumerError({
        message: 'the stream name used to post results is undefined',
        type: 'undefined-stream-name',
        function: functionName
      });
    }

    objectToBePosted.holdRequestId = obj.holdRequestId;
    objectToBePosted.jobId = obj.jobId || null;

    if (obj.errorType && obj.errorMessage) {
      objectToBePosted.success = false;
      objectToBePosted.error = {
        type: obj.errorType,
        message: obj.errorMessage
      };
    } else {
      objectToBePosted.success = true;
      objectToBePosted.error = null;
    }

    return streamsClient.write(streamName, objectToBePosted);
  }
};
