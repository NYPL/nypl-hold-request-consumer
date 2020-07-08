/* eslint-disable semi */
const async = require('async');
const axios = require('axios');
const qs = require('qs');
const HoldRequestConsumerError = require('../models/HoldRequestConsumerError');
const ResultStreamHelper = require('../helpers/ResultStreamHelper');
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

  this.handleErrorsByStatusCode = (error, record, serviceName, cb) => {
    const functionName = 'handleErrorsByStatusCode';
    const errorType = serviceName.replace(/\s+/g, '-').toLowerCase() + '-error';
    let errorMessage = `an error was received from the ${serviceName} for hold request record (${record.id})`;

    if (error.response) {
      const statusCode = error.response.status;
      const statusText = error.response.statusText.toLowerCase() || '';
      const errorResponseInfo = error.response.data || {};
      let errorTypeByService = '';
      let errorMessageByService = '';

      if (serviceName === 'Patron Service') {
        errorTypeByService = 'hold-request-record-missing-patron-data';
        errorMessageByService = `unable to retrieve Patron data from Patron Service for hold request record (${record.id})`;
      }

      if (serviceName === 'Item Service') {
        errorTypeByService = 'hold-request-record-missing-item-data';
        errorMessageByService = `unable to retrieve Item data from Item Service for hold request record (${record.id})`;
      }

      errorMessage += `; service responded with a status code: (${statusCode}) and status text: ${statusText}`;

      if (statusCode === 401) {
        logger.notice(
          errorMessage,
          { holdRequestId: record.id,
            record: record,
            errorResponse: errorResponseInfo
          }
        );
      } else {
        logger.error(
          errorMessage,
          { holdRequestId: record.id,
            record: record,
            errorResponse: errorResponseInfo
          }
        );
      }

      switch (statusCode) {
        case 400:
        case 404:
          // POST FAILURE TO STREAM
          logger.info(
            `posting hold request record (${record.id}) to HoldRequestResult stream; non-recoverable status code (${statusCode}); ${statusText}`,
            { holdRequestId: record.id }
          );

          return ResultStreamHelper.postRecordToStream({
            holdRequestId: record.id,
            jobId: record.jobId,
            errorType: errorTypeByService,
            errorMessage: errorMessageByService
          })
          .then(res => {
            logger.info(
              `successfully posted failed hold request record (${record.id}) to HoldRequestResult stream; removed failed record (${record.id}) from remaining records to be processed`,
              { holdRequestId: record.id }
            );

            return cb(null);
          })
          .catch(err => {
            logger.error(
              `unable to post failed hold request record (${record.id}) to results stream, received an error from HoldRequestResult stream; exiting promise chain due to fatal error`,
              { holdRequestId: record.id, error: err }
            );

            // At this point, we could not POST the failed hold request to the results stream.
            // We are exiting the promise chain and restarting the kinesis handler
            return cb(HoldRequestConsumerError({
              message: `unable to post failed hold request record (${record.id}) to results stream, received error from HoldRequestResult stream; exiting promise chain due to fatal error`,
              type: 'hold-request-result-stream-error',
              status: err.response && err.response.status ? err.response.status : null,
              function: 'postRecordToStream',
              error: err
            }));
          });
        case 401:
          return cb(
            HoldRequestConsumerError({
              message: errorMessage,
              type: 'access-token-invalid',
              status: statusCode,
              function: functionName,
              error: error.response
            })
          );
        case 403:
          return cb(
            HoldRequestConsumerError({
              message: errorMessage,
              type: 'access-forbidden-for-scopes',
              status: statusCode,
              function: functionName,
              error: error.response
            })
          );
        default:
          return cb(
            HoldRequestConsumerError({
              message: errorMessage,
              type: errorType,
              status: statusCode,
              function: functionName,
              error: error.response
            })
          );
      }
    }

    if (error.request) {
      logger.error(
        errorMessage,
        { holdRequestId: record.id,
          record: record,
          errorRequest: error.request
        }
      );

      return cb(
        HoldRequestConsumerError({
          message: errorMessage,
          type: errorType,
          function: functionName,
          error: error.request
        })
      );
    }

    // Something happened in setting up the request that triggered an Error
    logger.error(
      errorMessage,
      { holdRequestId: record.id,
        record: record,
        errorGeneric: error
      }
    );

    return cb(
      HoldRequestConsumerError({
        message: error.message,
        type: errorType,
        function: functionName,
        error: error.message
      })
    );
  };

  this._processGetItemDataRequests = (records, token, apiUrl) => {
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
            logger.notice(
              `unable to retrieve Item data for hold request record (${item.id}); will post to HoldRequestResult stream only for status codes 400/404`,
              { holdRequestId: item.id, record: item }
            );

            return this.handleErrorsByStatusCode(error, item, 'Item Service', callback);
          });
        }

        // Could not identify values for record id and nyplSource, post failure to stream
        logger.notice(
          `unable to perform GET request to Item Service for hold request record (${item.id}); empty/undefined nyplSource and/or record key values; posting failed hold request record (${item.id}) to HoldRequestResult stream`,
          { holdRequestId: item.id, record: item }
        );

        return ResultStreamHelper.postRecordToStream({
          holdRequestId: item.id,
          jobId: item.jobId,
          errorType: 'hold-request-record-missing-item-data',
          errorMessage: `unable to perform GET request to Item Service for hold request record (${item.id}); empty/undefined nyplSource and/or record key values`
        })
        .then(res => {
          logger.info(
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

  this._processGetPatronBarcodeRequests = (records, token, apiUrl) => {
    const nyplDataApiBaseUrl = apiUrl;

    return new Promise((resolve, reject) => {
      const loggerMessage = (records.length > 1) ? `${records.length} records` : `${records.length} record`;
      logger.info(`starting async iteration over ${loggerMessage} to fetch Patron data`);
      async.mapSeries(records, (item, callback) => {
        // Only process GET requests if the patron value is defined
        if (item.patron && item.patron !== '') {
          const patronBarcodeApi = `${nyplDataApiBaseUrl}patrons/${item.patron}`;

          logger.info(`fetching Patron data for hold request record (${item.id})`, { holdRequestId: item.id });
          return axios.get(patronBarcodeApi, this.constructApiHeaders(token))
          .then(response => {
            // Assign response object
            const patronApiResponse = response.data.data;

            // Verify existence of the patron barCodes array
            if (patronApiResponse && Array.isArray(patronApiResponse.barCodes) && patronApiResponse.barCodes.length) {
              logger.info(
                `successfully fetched Patron data, assigned response to hold request record (${item.id})`,
                { holdRequestId: item.id }
              );

              item['patronInfo'] = response.data.data;
              return callback(null, item);
            }

            // Post failure to HoldRequestResult stream if the patron barcodes array is empty or undefined
            logger.notice(
              `missing patron barCodes array in Patron Service response for hold request record (${item.id}); will post to HoldRequestResult stream`,
              { holdRequestId: item.id, record: item }
            );

            return ResultStreamHelper.postRecordToStream({
              holdRequestId: item.id,
              jobId: item.jobId,
              errorType: 'hold-request-record-missing-patron-data',
              errorMessage: `missing patron barCodes array in Patron Service response for hold request record (${item.id})`
            })
            .then(res => {
              logger.info(
                `successfully posted failed hold request record (${item.id}) to HoldRequestResult stream`,
                { holdRequestId: item.id }
              );
              // will skip to the next item and filter out record that is null
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
          })
          .catch((error) => {
            logger.notice(
              `unable to retrieve Patron data for hold request record (${item.id}); will post to HoldRequestResult stream only for status codes 400/404`,
              { holdRequestId: item.id, record: item }
            );

            return this.handleErrorsByStatusCode(error, item, 'Patron Service', callback);
          });
        }

        // POST FAILURE TO STREAM for missing patron id value
        logger.notice(
          `unable to perform GET request to Patron Service for hold request record (${item.id}); empty/undefined patron key value; posting failed hold request record (${item.id}) to HoldRequestResult stream`,
          { holdRequestId: item.id, record: item }
        );

        return ResultStreamHelper.postRecordToStream({
          holdRequestId: item.id,
          jobId: item.jobId,
          errorType: 'hold-request-record-missing-patron-data',
          errorMessage: `unable to perform GET request to Patron Service for hold request record (${item.id}); empty/undefined patron key value`
        })
        .then(res => {
          logger.info(
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

    if (!records.length) {
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the records array is empty, this may occur if records were filtered out once posted to the HoldRequestResult stream; cannot process async HTTP requests for empty records',
          type: 'empty-function-parameter',
          function: functionName,
          error: {
            type: type,
            apiUrl: apiUrl,
            records: records
          }
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
      return this._processGetItemDataRequests(records, accessToken, apiUrl);
    }

    if (type === 'patron-barcode-service') {
      return this._processGetPatronBarcodeRequests(records, accessToken, apiUrl);
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
          return Promise.resolve('new-access-token-set');
        }

        // We obtained a valid response. However, we could not get a value from access_token
        logger.error(`empty access_token value returned by OAuth Service in function: ${functionName}`);
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
          logger.error(
            `received a status outside of the 2xx range from OAuth Service in function: ${functionName}`,
            { error: error.response }
          );

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
          logger.error(
            `an error occurred from the OAuth Service; request was made, no response OAuth Service when attempting to fetch an access_token in function: ${functionName}`,
            { error: error.request }
          );

          return Promise.reject(HoldRequestConsumerError({
            message: `an error occurred from the OAuth Service; request was made, no response OAuth Service when attempting to fetch an access_token in function: ${functionName}`,
            type: 'oauth-service-error',
            function: functionName,
            error: error.request
          }));
        }

        logger.error(`an error occurred from the OAuth Service; no response OR request properties were returned in function: ${functionName}`);
        return Promise.reject(HoldRequestConsumerError({
          message: 'An internal server error occurred',
          type: 'oauth-service-error',
          function: functionName
        }));
      });
    }

    return Promise.resolve('access-token-exists-in-cache');
  };
}

module.exports = ApiServiceHelper;
