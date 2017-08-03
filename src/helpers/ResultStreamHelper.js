/* eslint-disable semi */
const NyplStreamsClient = require('@nypl/nypl-streams-client');
const HoldRequestConsumerError = require('../models/HoldRequestConsumerError');
const CACHE = require('../globals/index');

const ResultStreamHelper = module.exports = {
  postRecordToStream: (obj = {}, streamName = CACHE.getResultStreamName()) => {
    const functionName = 'postRecordToStream';
    const objectToBePosted = {};
    const streamsClient = new NyplStreamsClient({
      nyplDataApiClientBase: CACHE.getNyplDataApiBaseUrl()
    });

    if (!obj.holdRequestId || obj.holdRequestId === '') {
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the holdRequestId object property from the object parameter is not defined, unable to post record to stream',
          type: 'undefined-function-parameter',
          function: functionName
        })
      );
    }

    if (!streamName) {
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the streamName parameter used to post results is undefined',
          type: 'undefined-function-parameter',
          function: functionName
        })
      );
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
