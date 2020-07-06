const async = require('async');
const logger = require('../helpers/Logger');
const axios = require('axios');
const HoldRequestConsumerError = require('../models/HoldRequestConsumerError');
const ApiServiceHelper = require('./ApiServiceHelper');

const OnSiteHoldRequestHelper = module.exports = {
  handlePostingRecords: (records, apiData) => {
    const requests = records.map(OnSiteHoldRequestHelper.generateModel);

    return OnSiteHoldRequestHelper.processPostOnSiteHoldRequests(
      requests,
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
  processPostOnSiteHoldRequests: (requests, token, apiData) => {
    const { apiHelper } = apiData;
    return new Promise((resolve, reject) => {
      const onSiteHoldRequestResponses = async.mapSeries(requests, (request, callback) => {
        const isEdd = request.body.docDeliveryData.emailAddress;
        if (!isEdd) {
          logger.info(`Not implemented: on-site hold request for on-site use`, { holdRequestId: request.id, request: request.body });
          throw HoldRequestConsumerError({message: 'Not implemented: on-site hold request for on-site use'})
        }
        logger.info(`posting onsite hold request for item (${request.body.record})`, { holdRequestId: request.id });
        return axios.post(
          `${apiUrl}on-site-hold-requests`,
          request.body,
          ApiServiceHelper.constructApiHeaders(token)
        )
          .then(response => {
            console.log("response", response);
            if (response.status === 201) {
              if (isEdd) {
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

                  return callback(null, item);
                })
                .catch(err => {
                  logger.error(
                    `failed to post on-site EDD hold request record (${request.id}) to results stream, received an error from HoldRequestResult stream; exiting promise chain due to fatal error`,
                    { holdRequestId: request.id, error: err }
                  );

                  return callback(HoldRequestConsumerError({
                    message: `unable to post failed on-site EDD hold request record (${request.id}) to results stream, received error from HoldRequestResult stream; exiting promise chain due to fatal error`,
                    type: 'hold-request-result-stream-error',
                    status: err.response && err.response.status ? err.response.status : null,
                    function: 'postRecordToStream',
                    error: err
                  }));
                });
              }
            } else {
              logger.info(``, { holdRequestId: item.id });
              return callback(HoldRequestConsumerError({
                message: `On-site hold request record (${request.id}) to results stream, received error from HoldRequestResult stream; exiting promise chain due to fatal error`,
                type: 'hold-request-result-stream-error',
                status: err.response && err.response.status ? err.response.status : null,
                function: 'postRecordToStream',
                error: err
              }));
            }
          })
          .catch(error => {
            logger.notice(
              `unable to post hold request (${request.id}) to OnSiteHoldRequestService; will post to HoldRequestResult stream only for status codes 400/404`,
              { holdRequestId: request.id, holdRequest: request.body }
            );

            return apiHelper.handleErrorsByStatusCode(error, item, 'OnSiteHoldRequestService', callback);
          })
      })
    })
  }
}
