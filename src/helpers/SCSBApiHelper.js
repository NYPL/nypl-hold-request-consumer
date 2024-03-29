/* eslint-disable semi */
const async = require('async');
const bySierraLocation = require('@nypl/nypl-core-objects')('by-sierra-location');
const SCSBRestClient = require('@nypl/scsb-rest-client');
const HoldRequestConsumerError = require('../models/HoldRequestConsumerError');
const ResultStreamHelper = require('../helpers/ResultStreamHelper');
const logger = require('../helpers/Logger');

const SCSBApiHelper = module.exports = {
  handlePostingRecords: (records, scsbApiBaseUrl, scsbApiKey) => {
    const functionName = 'handlePostingRecordsToSCSBApi';

    if (!records || !Array.isArray(records)) {
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'an array is required for the records parameter; object, string, null or undefined types are forbidden',
          type: 'undefined-records-array-parameter',
          function: functionName,
          error: {
            records: records
          }
        })
      );
    }

    if (!records.length) {
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the records array is empty, this may occur if records were filtered out once posted to the HoldRequestResult stream; cannot process POST requests to the SCSB API for empty records',
          type: 'empty-records-array',
          function: functionName,
          error: {
            records: records
          }
        })
      );
    }

    if (!scsbApiBaseUrl) {
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the SCSB API base url parameter is not defined; unable to instantiate SCSB Rest Client',
          type: 'undefined-function-parameter',
          function: functionName
        })
      );
    }

    if (!scsbApiKey) {
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the SCSB API key parameter is not defined; unable to instantiate SCSB Rest Client',
          type: 'undefined-function-parameter',
          function: functionName
        })
      );
    }

    const scsbClient = new SCSBRestClient({ url: scsbApiBaseUrl, apiKey: scsbApiKey });

    return new Promise((resolve, reject) => {
      const loggerMessage = (records.length > 1) ? `${records.length} records` : `${records.length} record`;
      logger.info(`starting async iteration over ${loggerMessage} to POST into SCSB API`);
      async.mapSeries(records, (item, callback) => {
        const scsbModel = SCSBApiHelper.generateSCSBModel(item);

        logger.info(
          `posting hold request record (${item.id}) to SCSB API; request not initiated from SCSB UI`,
          { holdRequestId: item.id }
        );
        return scsbClient.addRequestItem(scsbModel)
        .then(result => {
          item['scsbResponse'] = result;

          if (result.success === true) {
            if (result.requestType === 'EDD') {
              logger.info(
                `hold request record (${item.id}) is an EDD request; will post EDD hold request record to HoldRequestResult stream`,
                { holdRequestId: item.id }
              );

              ResultStreamHelper.postRecordToStream({
                holdRequestId: item.id,
                jobId: item.jobId
              })
              .then(res => {
                logger.info(
                  `successfully posted EDD hold request record (${item.id}) to HoldRequestResult stream, assigned response to existing record`,
                  { holdRequestId: item.id }
                );

                return callback(null, item);
              })
              .catch(err => {
                logger.error(
                  `failed to post EDD hold request record (${item.id}) to results stream, received an error from HoldRequestResult stream; exiting promise chain due to fatal error`,
                  { holdRequestId: item.id, error: err }
                );

                // At this point, we could not POST the hold request to the results stream.
                // We are exiting the promise chain and restarting the kinesis handler
                return callback(HoldRequestConsumerError({
                  message: `unable to post failed EDD hold request record (${item.id}) to results stream, received error from HoldRequestResult stream; exiting promise chain due to fatal error`,
                  type: 'hold-request-result-stream-error',
                  status: err.response && err.response.status ? err.response.status : null,
                  function: 'postRecordToStream',
                  error: err
                }));
              });
            } else {
              logger.info(`successfully posted hold request record (${item.id}) to SCSB API, assigned response to existing record`, { holdRequestId: item.id });
              return callback(null, item);
            }
          } else {
            logger.error(
              `posting failed hold request record (${item.id}) to HoldRequestResult stream; the success flag is FALSE for hold request record; check debugInfo for SCSB error message`,
              { holdRequestId: item.id, debugInfo: SCSBApiHelper.getSCSBDebugInfo(result) }
            );

            return ResultStreamHelper.postRecordToStream({
              holdRequestId: item.id,
              jobId: item.jobId,
              errorType: 'scsb-api-response-success-false',
              errorMessage: `the SCSB API returned a false success flag for hold request record: ${item.id}; ${result.screenMessage}`
            })
            .then(response => {
              logger.info(
                `successfully posted failed hold request record (${item.id}) to HoldRequestResult stream; assigned SCSB response to existing record object`,
                { holdRequestId: item.id }
              );

              return callback(null, item);
            })
            .catch(error => {
              logger.error(
                `unable to post hold request record (${item.id}) to results stream, received an error from HoldRequestResult stream; exiting promise chain due to fatal error`,
                { holdRequestId: item.id, error: error }
              );

              // At this point, we could not POST the failed hold request to the results stream.
              // We are exiting the promise chain and restarting the kinesis handler
              return callback(HoldRequestConsumerError({
                message: `unable to post failed EDD hold request record (${item.id}) to results stream, received error from HoldRequestResult stream; exiting promise chain due to fatal error`,
                type: 'hold-request-result-stream-error',
                status: error.response && error.response.status ? error.response.status : null,
                function: 'postRecordToStream',
                error: error
              }));
            });
          }
        })
        .catch(errorResponse => {
          // SCSB API ERROR
          logger.error(
            `unable to post hold request record (${item.id}) to SCSB API, received an error from SCSB API; posting record to HoldRequestResult stream`,
            { holdRequestId: item.id, record: item, error: errorResponse }
          );

          return ResultStreamHelper.postRecordToStream({
            holdRequestId: item.id,
            jobId: item.jobId,
            errorType: 'scsb-api-error',
            errorMessage: `the SCSB API responded with an error while processing hold request record: ${item.id}`
          })
          .then(success => {
            logger.info(
              `successfully posted failed hold request record (${item.id}) to HoldRequestResult stream`,
              { holdRequestId: item.id, successResponse: success }
            );

            if (errorResponse && errorResponse.statusCode !== 404) {
              return callback(HoldRequestConsumerError({
                message: 'the SCSB API responded with an error',
                type: 'scsb-api-error',
                status: errorResponse.statusCode,
                function: 'postRecordToStream',
                error: errorResponse
              }));
            } else {
              return callback(null, item);
            }
          })
          .catch(failure => {
            if (failure) {
              // At this point, we could not POST the failed hold request to the results stream.
              // We are exiting the promise chain and restarting the kinesis handler
              return callback(HoldRequestConsumerError({
                message: `unable to post failed hold request record (${item.id}) to results stream, received error from HoldRequestResult stream; exiting promise chain due to fatal error`,
                type: 'hold-request-result-stream-error',
                function: 'postRecordToStream',
                error: failure
              }));
            }
          });
        });
      }, (err, results) => {
        return (err) ? reject(err) : resolve(results.filter(n => n));
      });
    });
  },
  getSCSBDebugInfo: (response = {}) => {
    let debug = {};

    if (response.hasOwnProperty('success')) {
      debug.success = response.success;
    }

    if (response.screenMessage) {
      debug.screenMessage = response.screenMessage;
    }

    if (response.requestType) {
      debug.requestType = response.requestType;
    }

    if (response.requestingInstitution) {
      debug.requestingInstitution = response.requestingInstitution;
    }

    if (response.deliveryLocation) {
      debug.deliveryLocation = response.deliveryLocation;
    }

    if (response.itemBarcodes) {
      debug.itemBarcodes = response.itemBarcodes;
    }

    return debug;
  },
  getInstitutionCode: (nyplCode) => {
    // Codes defined in https://htcrecap.atlassian.net/wiki/display/RTG/Request+Item

    // Check for partner institution code (e.g. recap-hl, recap-cul, recap-pul)
    if (/^recap-/.test(nyplCode)) {
      return nyplCode.split('-')[1].toUpperCase();
    }

    if (nyplCode === 'sierra-nypl') {
      return 'NYPL';
    }
  },
  generateSCSBModel: (object = {}) => {
    const scsbModel = {
      requestingInstitution: 'NYPL' // default
    };

    // Extract jobId which is equivalent to trackindId
    if (object.jobId) {
      scsbModel.trackingId = object.id;
    }

    // Extract requestType (hold or edd)
    if (object.requestType) {
      if (object.requestType.toLowerCase() === 'edd' || object.requestType.toLowerCase() !== 'hold') {
        scsbModel.requestType = object.requestType.toUpperCase();
      } else {
        scsbModel.requestType = 'RETRIEVAL';
      }
    }

    // Extract owniningInstitution, map to the correct institution code
    if (object.nyplSource) {
      scsbModel.itemOwningInstitution = SCSBApiHelper.getInstitutionCode(object.nyplSource);
    }

    // Extract Patron Barcode
    if (object.patronInfo && Array.isArray(object.patronInfo.barCodes) && object.patronInfo.barCodes.length) {
      const barCodesArray = object.patronInfo.barCodes;
      scsbModel.patronBarcode = barCodesArray[barCodesArray.length - 1]; // obtain last barcode item in array
    }

    if (object.item) {
      // Insert single item barcode in array
      if (object.item.barcode) {
        scsbModel.itemBarcodes = [object.item.barcode];
      }

      // Optional
      if (object.item.callNumber) {
        scsbModel.callNumber = object.item.callNumber;
      }
    }

    if (object.pickupLocation) {
      scsbModel.deliveryLocation = bySierraLocation[object.pickupLocation]['recapLocation']['code'];
    }

    // Handle EDD
    if (object.docDeliveryData) {
      const eddData = object.docDeliveryData;
      // Required for EDD
      if (eddData.emailAddress) {
        scsbModel.emailAddress = eddData.emailAddress;
      }
      // Required for EDD
      if (eddData.chapterTitle) {
        scsbModel.chapterTitle = eddData.chapterTitle;
      }
      // Required for EDD
      if (eddData.startPage) {
        scsbModel.startPage = eddData.startPage;
      }
      // Required for EDD
      if (eddData.endPage) {
        scsbModel.endPage = eddData.endPage;
      }

      // Optional for EDD
      if (eddData.author) {
        scsbModel.author = eddData.author;
      }

      // Optional for EDD
      if (eddData.issue) {
        scsbModel.issue = eddData.issue;
      }

      if (eddData.volume) {
        scsbModel.volume = eddData.volume;
      }

      if (eddData.requestNotes) {
        scsbModel.requestNotes = eddData.requestNotes;
      }
    }

    return scsbModel;
  }
};
