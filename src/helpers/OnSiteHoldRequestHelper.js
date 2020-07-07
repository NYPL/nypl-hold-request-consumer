const async = require('async');
const logger = require('../helpers/Logger');
const axios = require('axios');
const HoldRequestConsumerError = require('../models/HoldRequestConsumerError');
const ApiServiceHelper = require('./ApiServiceHelper');
const ResultStreamHelper = require('../helpers/ResultStreamHelper');

const OnSiteHoldRequestHelper = module.exports = {
  handlePostingRecords: (records, apiData) => {
    return OnSiteHoldRequestHelper.processPostOnSiteHoldRequests(
      records,
      apiData
    )
  },
  generateModel: ({
    patron,
    nyplSource,
    record,
    pickupLocation,
    neededBy,
    numberOfCopies,
    docDeliveryData,
    id,
    jobId,
    requestType,
  }) => {
    return {
      id,
      jobId,
      requestType,
      body: {
        patron,
        nyplSource,
        record,
        pickupLocation,
        neededBy,
        numberOfCopies,
        docDeliveryData
      }
    };
  },
  processPostOnSiteHoldRequests: (requests, apiData) => {
    const {
      apiHelper,
      apiKey,
      apiBaseUrl,
    } = apiData;
    return new Promise((resolve, reject) => {
      const onSiteHoldRequestResponses = async.mapSeries(requests, (request, callback) => {
        const isEdd = request.docDeliveryData && request.docDeliveryData.emailAddress;
        if (!isEdd) {
          logger.info(`Not implemented: on-site hold request for on-site use`, { holdRequestId: request.id });
          return ResultStreamHelper.postRecordToStream({
            holdRequestId: request.id,
            jobId: request.jobId,
            errorType: 'not-implemented-use-on-site-request',
            errorMessage: `Not implemented: on-site hold request for on-site use record ${request.id}`
          })
          .then(response => {
            logger.info(
              `successfully posted failed hold request record (${request.id}) to HoldRequestResult stream`,
              { holdRequestId: request.id }
            );

            return callback(null, request);
          })
          .catch(error => {
            logger.error(
              `unable to post hold request for on-site record to results stream, received an error from HoldRequestResult stream; exiting promise chain due to fatal error`,
              { holdRequestId: request.id, error: error }
            );

            // At this point, we could not POST the failed hold request to the results stream.
            // We are exiting the promise chain and restarting the kinesis handler
            return callback(HoldRequestConsumerError({
              message: `unable to post failed hold request for on-site record to results stream, received error from HoldRequestResult stream; exiting promise chain due to fatal error`,
              type: 'hold-request-result-stream-error',
              status: error.response && error.response.status ? error.response.status : null,
              function: 'postRecordToStream',
              error: error
            }));
          });
        }
        const requestBody = OnSiteHoldRequestHelper.generateModel(request)
        logger.info(`posting ${isEdd ? 'EDD ' : ''}hold request for on-site item (${requestBody.record})`, { holdRequestId: request.id });
        return axios.post(
          `${apiBaseUrl}on-site-hold-requests`,
          requestBody,
          apiHelper.constructApiHeaders(apiKey)
        )
          .then(response => {
            if (response.status === 201) {
              request.success = true;
              logger.info(
                `on-site hold request record (${request.id}) is an EDD request; will post EDD hold request record to HoldRequestResult stream`,
                { holdRequestId: request.id }
              );

              ResultStreamHelper.postRecordToStream({
                holdRequestId: request.id,
                jobId: request.jobId
              })
              .then(res => {
                logger.info(
                  `successfully posted on-site EDD hold request record (${request.id}) to HoldRequestResult stream, assigned response to existing record`,
                  { holdRequestId: request.id }
                );

                return callback(null, request);
              })
              .catch(err => {
                logger.error(
                  `failed to post on-site EDD hold request record (${request.id}) to results stream, received an error from HoldRequestResult stream; exiting promise chain due to fatal error`,
                  { holdRequestId: request.id, error: err }
                );

                return callback(HoldRequestConsumerError({
                  message: `unable to post failed EDD hold request record (${request.id}) to results stream, received error from HoldRequestResult stream; exiting promise chain due to fatal error`,
                  type: 'hold-request-result-stream-error',
                  status: err.response && err.response.status ? err.response.status : null,
                  function: 'postRecordToStream',
                  error: err
                }), request);
                });
            } else {
              logger.info(``, { holdRequestId: request.id });
              return callback(null, request);
            }
          })
          .catch(error => {
            logger.notice(
              `unable to post on-site hold request (${request.id}) to OnSiteHoldRequestService; will post to HoldRequestResult stream only for status codes 400/404`,
              { holdRequestId: request.id, holdRequest: request.body }
            );

            return callback(null, request);
          })
      }, (err, results) => {
        return (err) ? reject(err) : resolve(results.filter(n => n))
      })
    })
  }
}
