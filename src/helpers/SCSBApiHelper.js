/* eslint-disable semi */
const async = require('async');
const bySierraLocation = require('@nypl/nypl-core-objects')('by-sierra-location');
const SCSBRestClient = require('@nypl/scsb-rest-client');
const HoldRequestConsumerError = require('../models/HoldRequestConsumerError');
const ResultStreamHelper = require('../helpers/ResultStreamHelper');
const logger = require('../helpers/Logger');

const SCSBApiHelper = module.exports = {
  handlePostingRecordsToSCSBApi: (records, scsbApiBaseUrl, scsbApiKey) => {
    const functionName = 'handlePostingRecordsToSCSBApi';

    if (!scsbApiBaseUrl) {
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the SCSB API base url is not defined; unable to instantiate SCSB Rest Client',
          type: 'undefined-scsb-api-base-url',
          function: functionName
        })
      );
    }

    if (!scsbApiKey) {
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the SCSB API key is not defined; unable to instantiate SCSB Rest Client',
          type: 'undefined-scsb-api-key',
          function: functionName
        })
      );
    }

    const scsbClient = new SCSBRestClient({ url: scsbApiBaseUrl, apiKey: scsbApiKey });

    return new Promise((resolve, reject) => {
      logger.info(`starting async iteration over ${records.length} records to POST into SCSB API`);
      async.map(records, (item, callback) => {
        const scsbModel = SCSBApiHelper.generateSCSBModel(item);
        logger.info(`posting hold request record (${item.id}) to SCSB API`, { holdRequestId: item.id });
        return scsbClient.addRequestItem(scsbModel)
        .then(result => {
          item['scsbResponse'] = result;

          if (result.success === true) {
            if (result.requestType === 'EDD') {
              ResultStreamHelper.postRecordToStream({
                holdRequestId: item.id,
                jobId: item.jobId
              })
              .then(response => {
                logger.info(
                  `successfully posted EDD hold request record (${item.id}) to HoldRequestResult stream`,
                  { holdRequestId: item.id }
                );
              })
              .catch(err => {
                logger.error(
                  `failed to post EDD hold request record (${item.id}) to results stream, received an error from HoldRequestResults stream; exiting promise chain due to fatal error`,
                  { holdRequestId: item.id, error: err }
                );

                // At this point, we could not POST the failed hold request to the results stream.
                // We are exiting the promise chain and restarting the kinesis handler
                return callback(HoldRequestConsumerError({
                  message: `unable to post failed EDD hold request record (${item.id}) to results stream, received error from HoldRequestResults stream; exiting promise chain due to fatal error`,
                  type: 'hold-request-results-stream-error',
                  status: err.response && err.response.status ? err.response.status : null,
                  function: 'postRecordToStream',
                  error: err
                }));
              });
            }

            logger.info(`successfully posted hold request record (${item.id}) to SCSB API, assigned response to record`, { holdRequestId: item.id });
            return callback(null, item);
          } else {
            ResultStreamHelper.postRecordToStream({
              holdRequestId: item.id,
              jobId: item.jobId,
              errorType: 'scsb-api-success-flag-is-false',
              errorMessage: `the SCSB API returned a false success flag for hold request record: ${item.id}; ${result.screenMessage}`
            })
            .then(response => {
              logger.info(
                `posted failed hold request record (${item.id}) to HoldRequestResult stream; success flag is FALSE for hold request record`,
                { holdRequestId: item.id, debugInfo: SCSBApiHelper.getSCSBDebugInfo(result) }
              );
            })
            .catch(err => {
              logger.error(
                `failed to post hold request record (${item.id}) to results stream, received an error from HoldRequestResults stream; exiting promise chain due to fatal error`,
                { holdRequestId: item.id, error: err }
              );

              // At this point, we could not POST the failed hold request to the results stream.
              // We are exiting the promise chain and restarting the kinesis handler
              return callback(HoldRequestConsumerError({
                message: `unable to post failed EDD hold request record (${item.id}) to results stream, received error from HoldRequestResults stream; exiting promise chain due to fatal error`,
                type: 'hold-request-results-stream-error',
                status: err.response && err.response.status ? err.response.status : null,
                function: 'postRecordToStream',
                error: err
              }));
            });
          }
        })
        .catch(error => {
          console.log(error);
        });
      }, (err, results) => {
        return (err) ? reject(err) : resolve(results.filter(n => n));
      });
    });
  },
  getSCSBDebugInfo: (response) => {
    const debug = {};
    if (response.success) {
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
    if (nyplCode === 'recap-cul') {
      return 'CUL';
    }

    if (nyplCode === 'sierra-nypl') {
      return 'NYPL';
    }

    if (nyplCode === 'recap-pul') {
      return 'PUL';
    }
  },
  generateSCSBModel: (object) => {
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
    if (object.patronInfo && object.patronInfo.barCode) {
      scsbModel.patronBarcode = object.patronInfo.barCode;
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
