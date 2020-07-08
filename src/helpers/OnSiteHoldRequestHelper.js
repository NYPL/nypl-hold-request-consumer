const async = require('async')
const logger = require('../helpers/Logger')
const axios = require('axios')
const HoldRequestConsumerError = require('../models/HoldRequestConsumerError')
const ResultStreamHelper = require('../helpers/ResultStreamHelper')

const OnSiteHoldRequestHelper = module.exports = {
  generateModel: ({
    patron,
    nyplSource,
    record,
    pickupLocation,
    neededBy,
    numberOfCopies,
    docDeliveryData,
  }) => {
    return {
      patron,
      nyplSource,
      record,
      pickupLocation,
      neededBy,
      numberOfCopies,
      docDeliveryData
    }
  },
  handlePostingRecords: (requests, apiData) => {
    const {
      apiKey,
      apiBaseUrl
    } = apiData
    return new Promise((resolve, reject) => {
      async.mapSeries(requests, (request, callback) => {
        const isEdd = request.docDeliveryData && request.docDeliveryData.emailAddress
        /*
          if on-site hold requests are implemented for on-site use
          this conditional is no longer relevant
        */
        if (!isEdd) {
          logger.info(`Not implemented: on-site hold request for on-site use`, { holdRequestId: request.id })
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
            )

            return callback(null, request)
          })
          .catch(error => {
            logger.error(
              `unable to post hold request for on-site record to results stream, received an error from HoldRequestResult stream; exiting promise chain due to fatal error`,
              { holdRequestId: request.id, error: error }
            )

            // At this point, we could not POST the failed hold request to the results stream.
            // We are exiting the promise chain and restarting the kinesis handler
            return callback(HoldRequestConsumerError({
              message: `unable to post failed hold request for on-site record to results stream, received error from HoldRequestResult stream; exiting promise chain due to fatal error`,
              type: 'hold-request-result-stream-error',
              status: error.response && error.response.status ? error.response.status : null,
              function: 'postRecordToStream',
              error: error
            }))
          })
        }
        const eddLogText = isEdd ? 'EDD ' : ''
        const requestBody = OnSiteHoldRequestHelper.generateModel(request)
        logger.info(`posting ${eddLogText}hold request for on-site item (${requestBody.record})`, { holdRequestId: request.id })
        const apiHeaders = {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          timeout: 10000
        }

        return axios.post(
          `${apiBaseUrl}on-site-hold-requests`,
          requestBody,
          apiHeaders
        )
        .then(response => {
          if (Math.floor(response.status / 100) === 2) request.success = true
          const { success } = request
          const logLevel = success ? 'info' : 'error'
          logger[logLevel](
            `on-site ${eddLogText}hold request record (${request.id}) ${success ? 'succeed' : 'failed'}; will post hold request record to HoldRequestResult stream`,
            { holdRequestId: request.id }
          )

          ResultStreamHelper.postRecordToStream({
            holdRequestId: request.id,
            jobId: request.jobId,
            errorType: success ? null : 'on-site-hold-request-service-post-unsuccessful',
            errorMessage: success ? null : 'Response from OnSiteHoldRequestService was not successful'
          })
          .then(res => {
            logger.info(
              `successfully posted on-site ${eddLogText}hold request record (${request.id}) to HoldRequestResult stream`,
              { holdRequestId: request.id }
            )

            return callback(null, request)
          })
          .catch(err => {
            logger.error(
              `failed to post on-site ${eddLogText}hold request record (${request.id}) to results stream, received an error from HoldRequestResult stream; exiting promise chain due to fatal error`,
              { holdRequestId: request.id, error: err }
            )

            return callback(HoldRequestConsumerError({
              message: `unable to post failed EDD hold request record (${request.id}) to results stream, received error from HoldRequestResult stream; exiting promise chain due to fatal error`,
              type: 'hold-request-result-stream-error',
              status: err.response && err.response.status ? err.response.status : null,
              function: 'postRecordToStream',
              error: err
            }))
          })
        })
        .catch(error => {
          const { response } = error;
          const { statusText, statusCode } = response;
          logger.error(
            `unable to post on-site ${eddLogText}hold request (${request.id}) to OnSiteHoldRequestService; will post to HoldRequestResult stream`,
            { holdRequestId: request.id, holdRequest: request.body, error: { statusText, statusCode } }
          )

          ResultStreamHelper.postRecordToStream({
            holdRequestId: request.id,
            jobId: request.jobId,
            errorType: 'on-site-hold-request-service-post-unsuccessful',
            errorMessage: 'Response from OnSiteHoldRequestService was not successful'
          })
          .then(res => {
            logger.info(
              `successfully posted failed on-site ${eddLogText}hold request record (${request.id}) to HoldRequestResult stream`,
              { holdRequestId: request.id }
            )

            return callback(null, request)
          })
          .catch(err => {
            logger.error(
              `failed to post failed on-site ${eddLogText}hold request record (${request.id}) to results stream, received an error from HoldRequestResult stream; exiting promise chain due to fatal error`,
              { holdRequestId: request.id, error: err }
            )

            return callback(HoldRequestConsumerError({
              message: `unable to post failed EDD hold request record (${request.id}) to results stream, received error from HoldRequestResult stream; exiting promise chain due to fatal error`,
              type: 'hold-request-result-stream-error',
              status: err.response && err.response.status ? err.response.status : null,
              function: 'postRecordToStream',
              error: err
            }))
          })
        })
      }, (err, results) => {
        return (err) ? reject(err) : resolve(results.filter(n => n))
      })
    })
  }
}
