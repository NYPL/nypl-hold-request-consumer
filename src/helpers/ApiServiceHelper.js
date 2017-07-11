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

  this.areRequiredParamsValid = () => {
    return (this.oauthUrl !== '' || this.clientId !== '' ||
      this.clientSecret !== '' || this.scope !== '');
  };

  this.processGetItemDataRequests = (records, token) => {
    const functionName = 'processGetItemDataRequests';
    const nyplDataApiBaseUrl = CACHE.getNyplDataApiBaseUrl();

    if (!nyplDataApiBaseUrl || nyplDataApiBaseUrl === '') {
      logger.error('unable to process GET requests to Item Service for records; missing NYPL Data API base url');
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the NYPL Data API base url not defined in CACHE',
          type: 'undefined-cached-variable',
          function: functionName
        })
      );
    }

    return new Promise((resolve, reject) => {
      logger.info(`starting async iteration over ${records.length} records to fetch Item data for each record`);
      async.mapSeries(records, (item, callback) => {
        // Only process GET request if the record and nyplSource values are defined
        if (item.record && item.record !== '' && item.nyplSource && item.nyplSource !== '') {
          const itemApi = `${nyplDataApiBaseUrl}items/${item.nyplSource}/${item.record}`;

          logger.info('fetching item data for hold request record', { holdRequestId: item.id });
          return axios.get(itemApi, this.constructApiHeaders(token))
          .then(response => {
            logger.info('successfully fetched item data, assigned response to hold request record', { holdRequestId: item.id });
            item['item'] = response.data.data;
            return callback(null, item);
          })
          .catch(error => {
            // POST FAILURE TO STREAM
            logger.error(
              'unable to retrieve item data for hold request record, posting failed record to HoldRequestResult stream',
              { holdRequestId: item.id, record: item, error: error.response || error }
            );

            return ResultStreamHelper.postRecordToStream({
              holdRequestId: item.id,
              jobId: item.jobId,
              errorType: 'hold-request-record-missing-item-data',
              errorMessage: `unable to retrieve item data from Item Service for hold request record: ${item.id}`
            })
            .then(res => {
              logger.error(
                'successfully posted failed hold request record to HoldRequestResult stream',
                { holdRequestId: item.id }
              );

              ResultStreamHelper.handleErrorCodesFallback(error, item.id, 'Item Service', callback);
            })
            .catch(err => {
              logger.error(
                'unable to post failed hold request record to results stream, received an error from HoldRequestResults stream; exiting promise chain due to fatal error',
                { holdRequestId: item.id, error: err }
              );

              // At this point, we could not POST the failed hold request to the results stream.
              // We are exiting the promise chain and restarting the kinesis handler
              return callback(HoldRequestConsumerError({
                message: `unable to post failed hold request record (${item.id}) to results stream, received error from HoldRequestResults stream; exiting promise chain due to fatal error`,
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
          'unable to perform GET request to Item Service for hold request record; empty/undefined nyplSource and/or record key values',
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
            'successfully posted failed hold request record to HoldRequestResults stream',
            { holdRequestId: item.id }
          );
          return callback(null);
        })
        .catch(err => {
          logger.error(
            'unable to post failed hold request record to results stream, received an error from HoldRequestResults stream; exiting promise chain due to fatal error',
            { holdRequestId: item.id, error: err }
          );

          // At this point, we could not POST the failed hold request to the results stream.
          // We are exiting the promise chain and restarting the kinesis handler
          return callback(HoldRequestConsumerError({
            message: `unable to post failed hold request record (${item.id}) to results stream, received an error from HoldRequestResults stream; exiting promise chain due to fatal error`,
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

  this.processGetPatronBarcodeRequests = (records, token) => {
    const functionName = 'processGetPatronBarcodeRequests';
    const nyplDataApiBaseUrl = CACHE.getNyplDataApiBaseUrl();

    if (!nyplDataApiBaseUrl || nyplDataApiBaseUrl === '') {
      logger.error('unable to process GET requests to Patron Service for records; missing NYPL Data API base url');
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the NYPL Data API base url not defined in CACHE',
          type: 'undefined-cached-variable',
          function: functionName
        })
      );
    }

    return new Promise((resolve, reject) => {
      logger.info(`starting async iteration over ${records.length} records to fetch patron data for each record`);
      async.mapSeries(records, (item, callback) => {
        // Only process GET requests if the patron value is defined
        if (item.patron && item.patron !== '') {
          const patronBarcodeApi = `${nyplDataApiBaseUrl}patrons/${item.patron}/barcode`;

          logger.info('fetching patron data for hold request record', { holdRequestId: item.id });
          return axios.get(patronBarcodeApi, this.constructApiHeaders(token))
          .then(response => {
            logger.info('successfully fetched patron data, assigned response to hold request record', { holdRequestId: item.id });
            item['patronInfo'] = response.data.data;
            return callback(null, item);
          })
          .catch((error) => {
            // POST failure to HoldRequestResult Stream
            logger.error(
              `unable to retrieve patron data for hold request record: (${item.id}), posting failed record to HoldRequestResult stream`,
              { holdRequestId: item.id, record: item, error: error.response || error }
            );
            return ResultStreamHelper.postRecordToStream({
              holdRequestId: item.id,
              jobId: item.jobId,
              errorType: 'hold-request-record-missing-patron-data',
              errorMessage: `unable to retrieve patron data from Patron Service for hold request record: ${item.id}`
            })
            .then(res => {
              logger.error(
                'successfully posted failed hold request record to HoldRequestResults stream',
                { holdRequestId: item.id }
              );

              ResultStreamHelper.handleErrorCodesFallback(error, item.id, 'Patron Service', callback);
            })
            .catch(err => {
              logger.error(
                `unable to post failed hold request record (${item.id}) to results stream, received an error from HoldRequestResults stream; exiting promise chain due to fatal error`,
                { holdRequestId: item.id, error: err }
              );

              // At this point, we could not POST the failed hold request to the results stream.
              // We are exiting the promise chain and restarting the kinesis handler
              return callback(HoldRequestConsumerError({
                message: `unable to post failed hold request record (${item.id}) to results stream, received an error from HoldRequestResults stream; exiting promise chain due to fatal error`,
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
          'unable to perform GET request to Patron Service for hold request record; empty/undefined patron key value',
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
            'successfully posted failed hold request record to HoldRequestResults stream',
            { holdRequestId: item.id }
          );
          return callback(null);
        })
        .catch(err => {
          logger.error(
            `unable to post failed hold request record (${item.id}) to results stream, received error from HoldRequestResults stream; exiting promise chain due to fatal error`,
            { holdRequestId: item.id, error: err }
          );

          // At this point, we could not POST the failed hold request to the results stream.
          // We are exiting the promise chain and restarting the kinesis handler
          return callback(HoldRequestConsumerError({
            message: `unable to post failed hold request record (${item.id}) to results stream, received error from HoldRequestResults stream; exiting promise chain due to fatal error`,
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

  this.handleHttpAsyncRequests = (records, type) => {
    const functionName = 'handleHttpAsyncRequests';
    // Retrieve CACHED access_token initialized at the beginning of the handler
    const token = CACHE.getAccessToken();

    if (!token || token === '') {
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the OAuth access_token is not defined or empty in CACHE, could not perform HTTP async requests',
          type: 'undefined-cached-variable',
          function: functionName
        })
      );
    }

    if (!records.length) {
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the hold requests records array is empty',
          type: 'empty-function-parameter',
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
      return this.processGetItemDataRequests(records, token);
    }

    if (type === 'patron-barcode-service') {
      return this.processGetPatronBarcodeRequests(records, token);
    }
  };

  this.getTokenFromOAuthService = (cachedToken) => {
    const functionName = 'getTokenFromOAuthService';
    const authConfig = {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: this.grantType,
      scope: this.scope
    };

    if (!cachedToken) {
      logger.info('fetching new access_token from OAuth Service');
      return axios
      .post(this.oauthUrl, qs.stringify(authConfig))
      .then((response) => {
        if (response && response.data && response.data.access_token) {
          logger.info('successfully obtained a new access_token from OAuth Service');
          return response.data.access_token;
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
    } else {
      logger.info('already obtained an access_token from CACHE, not executing call to get token from OAuth Service');
      Promise.resolve(cachedToken);
    }
  };
}

module.exports = ApiServiceHelper;
