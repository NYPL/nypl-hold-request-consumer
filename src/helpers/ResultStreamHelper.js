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
  },
  handleErrorCodesFallback: (errorObj, holdRequestId, serviceName, callback) => {
    console.log(errorObj);
    const functionName = 'handleErrorCodesFallback';
    const errorMessage = `an error was received from the ${serviceName} for HoldRequestId: ${holdRequestId}`;
    const errorType = (serviceName !== '') ? serviceName.replace(/\s+/g, '-').toLowerCase() + '-error' : 'service-error';
    if (errorObj.response) {
      // If the status code is 401, we know the OAuth token expired, we want to exit out of the
      // promise chain and restart the kinesis handler to get a new token.
      if (errorObj.response.status === 401) {
        return callback(
          HoldRequestConsumerError({
            message: errorMessage,
            type: 'access-token-invalid',
            status: errorObj.response.status,
            function: functionName,
            error: errorObj.response
          })
        );
      }
      if (errorObj.response.status === 403) {
        // Obtained when the SCOPES are invalid, exit the promise chain and restart the handler
        return callback(
          HoldRequestConsumerError({
            message: errorMessage,
            type: 'access-forbidden-for-scopes',
            status: errorObj.response.status,
            function: functionName,
            error: errorObj.response
          })
        );
      }

      if (errorObj.response.status !== 404) {
        return callback(
          HoldRequestConsumerError({
            message: errorMessage,
            type: errorType,
            status: errorObj.response.status,
            function: functionName,
            error: errorObj.response
          })
        );
      }
    }

    // Continue processing records, mainly for 404 server responses
    return callback(null);
  }
};
