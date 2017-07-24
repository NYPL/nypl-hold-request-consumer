/* eslint-disable semi */
const async = require('async');
const axios = require('axios');
const qs = require('qs');
const NyplStreamsClient = require('@nypl/nypl-streams-client');
const HoldRequestConsumerError = require('../models/HoldRequestConsumerError');
const ResultStreamHelper = require('../helpers/ResultStreamHelper')
const logger = require('../helpers/Logger');
const CACHE = require('../globals/index');

function ApiServiceHelper (url = '', clientId = '', clientSecret = '', scope = '', grantType = 'client_credentials') {
  if (!(this instanceof ApiServiceHelper)) {
    return new ApiServiceHelper(url, clientId, clientSecret, scope, grantType);
  }

  this.oauthUrl = url;
  this.clientId = clientId;
  this.clientSecret = clientSecret;
  this.scope = scope;
  this.grantType = grantType;

  this.constructApiHeaders = (token = '', contentType = 'application/json', timeOut = 10000) => {
    return {
      headers: {
        'Content-Type': contentType,
        Authorization: `Bearer ${token}`
      },
      timeout: timeOut
    };
  };

  this.processGetItemDataRequests = (records, token, apiUrl) => {
    const functionName = 'processGetItemDataRequests';
    const nyplDataApiBaseUrl = apiUrl;

    return new Promise((resolve, reject) => {
      const loggerMessage = (records.length > 1) ? `${records.length} records` : `${records.length} record`;
      logger.info(`starting async iteration over ${loggerMessage} to fetch Item data`);
      async.mapSeries(records, (item, callback) => {
        // Only process GET request if the record and nyplSource values are defined
        if (item.record && item.record !== '' && item.nyplSource && item.nyplSource !== '') {
          const itemApi = `${nyplDataApiBaseUrl}items/${item.nyplSource}/${item.record}`;

          logger.info(`fetching Item data for hold request record (${item.id})`, { holdRequestId: item.id });
          return axios.get(itemApi, this.constructApiHeaders(token))
          .then(response => {
            logger.info(`successfully fetched Item data, assigned response to hold request record (${item.id})`, { holdRequestId: item.id });
            item['item'] = response.data.data;
            return callback(null, item);
          })
          .catch(error => {
            // POST FAILURE TO STREAM
            logger.error(
              `unable to retrieve Item data for hold request record (${item.id}), posting failed record to HoldRequestResult stream`,
              { holdRequestId: item.id, record: item, error: error.response || error }
            );

            return ResultStreamHelper.postRecordToStream({
              holdRequestId: item.id,
              jobId: item.jobId,
              errorType: 'hold-request-record-missing-item-data',
              errorMessage: `unable to retrieve Item data from Item Service for hold request record (${item.id})`
            })
            .then(res => {
              logger.info(
                `successfully posted failed hold request record (${item.id}) to HoldRequestResult stream`,
                { holdRequestId: item.id }
              );

              ResultStreamHelper.handleErrorCodesFallback(error, item.id, 'Item Service', callback);
            })
            .catch(err => {
              logger.error(
                'unable to post failed hold request record (${item.id}) to results stream, received an error from HoldRequestResult stream; exiting promise chain due to fatal error',
                { holdRequestId: item.id, error: err }
              );

              // At this point, we could not POST the failed hold request to the results stream.
              // We are exiting the promise chain and restarting the kinesis handler
              return callback(HoldRequestConsumerError({
                message: `unable to post failed hold request record (${item.id}) to results stream, received error from HoldRequestResult stream; exiting promise chain due to fatal error`,
                type: 'hold-request-result-stream-error',
                status: err.response && err.response.status ? err.response.status : null,
                function: 'postRecordToStream',
                error: err
              }));
            });
          });
        }

        // Could not identify values for record id and nyplSource, post failure to stream
        logger.error(
          `unable to perform GET request to Item Service for hold request record (${item.id}); empty/undefined nyplSource and/or record key values`,
          { holdRequestId: item.id, record: item }
        );

        return ResultStreamHelper.postRecordToStream({
          holdRequestId: item.id,
          jobId: item.jobId,
          errorType: 'hold-request-record-missing-item-data',
          errorMessage: `unable to perform GET request to Item Service for hold request record (${item.id}); empty/undefined nyplSource and/or record key values`
        })
        .then(res => {
          logger.error(
            `successfully posted failed hold request record (${item.id}) to HoldRequestResult stream`,
            { holdRequestId: item.id }
          );
          return callback(null);
        })
        .catch(err => {
          logger.error(
            `unable to post failed hold request record (${item.id}) to results stream, received an error from HoldRequestResult stream; exiting promise chain due to fatal error`,
            { holdRequestId: item.id, error: err }
          );

          // At this point, we could not POST the failed hold request to the results stream.
          // We are exiting the promise chain and restarting the kinesis handler
          return callback(HoldRequestConsumerError({
            message: `unable to post failed hold request record (${item.id}) to results stream, received an error from HoldRequestResult stream; exiting promise chain due to fatal error`,
            type: 'hold-request-result-stream-error',
            status: err.response && err.response.status ? err.response.status : null,
            function: 'postRecordToStream',
            error: err
          }));
        });
      }, (err, results) => {
        return (err) ? reject(err) : resolve(results.filter(n => n));
      });
    });
  };

  this.processGetPatronBarcodeRequests = (records, token, apiUrl) => {
    const functionName = 'processGetPatronBarcodeRequests';
    const nyplDataApiBaseUrl = apiUrl;

    return new Promise((resolve, reject) => {
      const loggerMessage = (records.length > 1) ? `${records.length} records` : `${records.length} record`;
      logger.info(`starting async iteration over ${loggerMessage} to fetch Patron data`);
      async.mapSeries(records, (item, callback) => {
        // Only process GET requests if the patron value is defined
        if (item.patron && item.patron !== '') {
          const patronBarcodeApi = `${nyplDataApiBaseUrl}patrons/${item.patron}/barcode`;

          logger.info(`fetching Patron data for hold request record (${item.id})`, { holdRequestId: item.id });
          return axios.get(patronBarcodeApi, this.constructApiHeaders(token))
          .then(response => {
            logger.info(
              `successfully fetched Patron data, assigned response to hold request record (${item.id})`,
              { holdRequestId: item.id }
            );
            item['patronInfo'] = response.data.data;
            return callback(null, item);
          })
          .catch((error) => {
            // POST failure to HoldRequestResult Stream
            logger.error(
              `unable to retrieve Patron data for hold request record (${item.id}), posting failed record to HoldRequestResult stream`,
              { holdRequestId: item.id, record: item, error: error.response || error }
            );
            return ResultStreamHelper.postRecordToStream({
              holdRequestId: item.id,
              jobId: item.jobId,
              errorType: 'hold-request-record-missing-patron-data',
              errorMessage: `unable to retrieve Patron data from Patron Service for hold request record (${item.id})`
            })
            .then(res => {
              logger.error(
                `successfully posted failed hold request record (${item.id}) to HoldRequestResult stream`,
                { holdRequestId: item.id }
              );

              ResultStreamHelper.handleErrorCodesFallback(error, item.id, 'Patron Service', callback);
            })
            .catch(err => {
              logger.error(
                `unable to post failed hold request record (${item.id}) to results stream, received an error from HoldRequestResult stream; exiting promise chain due to fatal error`,
                { holdRequestId: item.id, error: err }
              );

              // At this point, we could not POST the failed hold request to the results stream.
              // We are exiting the promise chain and restarting the kinesis handler
              return callback(HoldRequestConsumerError({
                message: `unable to post failed hold request record (${item.id}) to results stream, received an error from HoldRequestResult stream; exiting promise chain due to fatal error`,
                type: 'hold-request-result-stream-error',
                status: err.response && err.response.status ? err.response.status : null,
                function: 'postRecordToStream',
                error: err
              }));
            });
          });
        }

        // POST FAILURE TO STREAM for missing patron id value
        logger.error(
          `unable to perform GET request to Patron Service for hold request record (${item.id}); empty/undefined patron key value`,
          { holdRequestId: item.id, record: item }
        );

        return ResultStreamHelper.postRecordToStream({
          holdRequestId: item.id,
          jobId: item.jobId,
          errorType: 'hold-request-record-missing-patron-data',
          errorMessage: `unable to perform GET request to Patron Service for hold request record (${item.id}); empty/undefined patron key value`
        })
        .then(res => {
          logger.error(
            `successfully posted failed hold request record (${item.id}) to HoldRequestResult stream`,
            { holdRequestId: item.id }
          );
          return callback(null);
        })
        .catch(err => {
          logger.error(
            `unable to post failed hold request record (${item.id}) to results stream, received error from HoldRequestResult stream; exiting promise chain due to fatal error`,
            { holdRequestId: item.id, error: err }
          );

          // At this point, we could not POST the failed hold request to the results stream.
          // We are exiting the promise chain and restarting the kinesis handler
          return callback(HoldRequestConsumerError({
            message: `unable to post failed hold request record (${item.id}) to results stream, received error from HoldRequestResult stream; exiting promise chain due to fatal error`,
            type: 'hold-request-result-stream-error',
            status: err.response && err.response.status ? err.response.status : null,
            function: 'postRecordToStream',
            error: err
          }));
        });
      }, (err, results) => {
        return (err) ? reject(err) : resolve(results.filter(n => n));
      });
    });
  };

  this.handleHttpAsyncRequests = (records, type, apiUrl, accessToken) => {
    const functionName = 'handleHttpAsyncRequests';

    // Filter out records from stream with a processed flag of true since these were posted to the stream via
    // the PATCH /api/v0.1/hold-requests endpoint which have already been sent to SCSB.
    logger.info(`filter records array to only unprocessed requests. will be empty if all requests have been processed.`);
    records = records.filter(function (record) {
      return record.processed === false;
    });

    if (!records.length) {
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the hold requests records array is empty',
          type: 'empty-function-parameter',
          function: functionName
        })
      );
    }

    if (!accessToken || accessToken === '') {
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the accessToken parameter is not defined, could not execute HTTP async requests without a valid access_token',
          type: 'undefined-function-parameter',
          function: functionName
        })
      );
    }

    if (!apiUrl || apiUrl === '') {
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the API url parameter not defined , could not execute HTTP async requests without a valid API url',
          type: 'undefined-function-parameter',
          function: functionName
        })
      );
    }


    if (!type || type === '') {
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the type parameter is not defined or empty',
          type: 'undefined-function-parameter',
          function: functionName
        })
      );
    }

    if (type === 'item-service') {
      return this.processGetItemDataRequests(records, accessToken, apiUrl);
    }

    if (type === 'patron-barcode-service') {
      return this.processGetPatronBarcodeRequests(records, accessToken, apiUrl);
    }
  };

  this.setTokenFromOAuthService = () => {
    const functionName = 'setTokenFromOAuthService';
    const authConfig = {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: this.grantType,
      scope: this.scope
    };

    const cachedToken = CACHE.getAccessToken();

    if (!cachedToken || cachedToken === '') {
      logger.info('fetching new access_token from OAuth Service; CACHED access_token is not defined');
      return axios
      .post(this.oauthUrl, qs.stringify(authConfig))
      .then((response) => {
        if (response && response.data && response.data.access_token) {
          logger.info('successfully obtained a new access_token from OAuth Service, saved access_token to CACHE');
          CACHE.setAccessToken(response.data.access_token);
          return 'new-access-token-set';
        }

        // We obtained a valid response. However, we could not get a value from access_token
        logger.error(`empty access_token value from OAuth Service response in function: ${functionName}`);
        return Promise.reject(HoldRequestConsumerError({
          message: 'empty access_token value from OAuth Service',
          type: 'empty-access-token-from-oauth-service',
          function: functionName
        }));
      })
      .catch((error) => {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          logger.error(`received a status outside of the 2xx range from OAuth Service in function: ${functionName}`);
          return Promise.reject(HoldRequestConsumerError({
            message: 'received a status outside of the 2xx range',
            type: 'oauth-service-error',
            status: error.response.status,
            function: functionName,
            error: {
              method: error.response.request.method,
              url: error.response.request.path,
              headers: error.response.headers,
              data: error.response.data
            }
          }));
        }

        if (error.request) {
          // The request was made but no response was received
          logger.error(`request was made, no response OAuth Service in function: ${functionName}`);
          return Promise.reject(HoldRequestConsumerError({
            message: 'request was made, no response from OAuth Service',
            type: 'oauth-service-error',
            function: functionName,
            error: error.request
          }));
        }

        logger.error(`an internal server error occurred from OAuth Service in function: ${functionName}`);
        return Promise.reject(HoldRequestConsumerError({
          message: 'An internal server error occurred',
          type: 'oauth-service-error',
          status: 500,
          function: functionName
        }));
      })
    }

    return Promise.resolve('access-token-exists-in-cache');
  };
}

module.exports = ApiServiceHelper;
