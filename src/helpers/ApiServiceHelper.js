/* eslint-disable semi */
const async = require('async');
const axios = require('axios');
const qs = require('qs');
const HoldRequestConsumerError = require('../models/HoldRequestConsumerError');
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

  this.constructApiHeaders = (token = '', contentType = 'application/json') => {
    return {
      headers: {
        'Content-Type': contentType,
        Authorization: `Bearer ${token}`
      },
      timeout: 10000
    };
  };

  this.areRequiredParamsValid = () => {
    return (this.oauthUrl === '' || this.clientId === '' ||
      this.clientSecret === '' || this.scope === '') ? false : true;
  };

  this.handleErrors = (errorResponse) => {
    console.log(errorResponse);
  };


  this.processGetItemDataRequests = (records, token) => {
    const functionName = 'processGetItemDataRequests';
    const nyplDataApiBase = CACHE.getNyplDataApiBase();

    if (!nyplDataApiBase || nyplDataApiBase === '') {
      logger.error('unable to process GET requests to Item Service for records; missing NYPL Data API base url');
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the NYPL Data API base url not defined in CACHE',
          type: 'undefined-nypl-data-api-base-url',
          function: functionName
        })
      );
    }

    logger.info(`starting async iteration over ${records.length} records to fetch item data for each record`);
    return new Promise((resolve, reject) => {
      async.map(records, (item, callback) => {
        // Only process GET requests if the record and nyplSource values are defined
        if (item.record && item.record !== ''
          && item.nyplSource && item.nyplSource !== '') {
          const itemApi = `${nyplDataApiBase}items/${item.nyplSource}/${item.record}`;
          logger.info('fetching item data for hold request record', { holdRequestId: item.id });
          return axios.get(itemApi, this.constructApiHeaders(token))
          .then(response => {
            logger.info('successfully fetched item data, assigned response to hold request record', { holdRequestId: item.id });
            item['item'] = response.data.data;
            return callback(null, item);
          })
          .catch((error) => {
            const hrcError = HoldRequestConsumerError({
              message: `an error was received from Item Service for HoldRequestId: ${item.id}`,
              type: 'item-service-error',
              status: error.response && error.response.status ? error.response.status : 400,
              function: functionName,
              error : error.response || null
            });

            // TODO: POST FAILURE TO STREAM
            logger.error(
              'unable to retrieve item data for hold request record, posting failed record to HoldRequestResult stream',
              { holdRequestId: item.id, record: item }
            );

            // Ignore all other failures and continue with callback, except 401 (access_token expired)
            return (error.response && error.response.status === 401) ? callback(hrcError) : callback(null);
          });
        }

        // TODO: POST FAILURE TO STREAM
        logger.error(
          'unable to perform GET request to Item Service for hold request record; empty/undefined nyplSource and record key values',
          { holdRequestId: item.id, record: item }
        );
        return callback(null);
      }, (err, results) => {
        return (err) ? this.handleErrors(err) : resolve(results.filter(n => n));
      });
    });
  };

  this.processGetPatronBarcodeRequests = (records, token) => {
    const functionName = 'processGetPatronBarcodeRequests';
    const nyplDataApiBase = CACHE.getNyplDataApiBase();

    if (!nyplDataApiBase || nyplDataApiBase === '') {
      logger.error('unable to process GET requests to Patron Service for records; missing NYPL Data API base url');
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the NYPL Data API base url not defined in CACHE',
          type: 'undefined-nypl-data-api-base-url',
          function: functionName
        })
      );
    }

    logger.info(`starting async iteration over ${records.length} records to fetch patron data for each record`);
    return new Promise((resolve, reject) => {
      async.map(records, (item, callback) => {
        // Only process GET requests if the patron value is defined
        if (item.patron && item.patron !== '') {
          const patronBarcodeApi = `${nyplDataApiBase}patrons/${item.patron}/barcode`;
          logger.info('fetching patron data for hold request record', { holdRequestId: item.id });
          return axios.get(patronBarcodeApi, this.constructApiHeaders(token))
          .then(response => {
            logger.info('successfully fetched patron data, assigned response to hold request record', { holdRequestId: item.id });
            item['patronInfo'] = response.data.data;
            return callback(null, item);
          })
          .catch((error) => {
            const hrcError = HoldRequestConsumerError({
              message: `an error was received from Patron Service for HoldRequestId: ${item.id}`,
              type: 'patron-service-error',
              status: error.response && error.response.status ? error.response.status : 400,
              function: functionName,
              error : error.response || null
            });

            // TODO: POST FAILURE TO STREAM
            logger.error(
              'unable to retrieve patron data for hold request record, posting failed record to HoldRequestResult stream',
              { holdRequestId: item.id, record: item }
            );

            // Ignore all other failures and continue with callback, except 401 (access_token expired)
            return (error.response && error.response.status === 401) ? callback(hrcError) : callback(null);
          });
        }

        // TODO: POST FAILURE TO STREAM
        logger.error(
          'unable to perform GET request to Patron Service for hold request record; empty/undefined patron key value',
          { holdRequestId: item.id, record: item }
        );
        return callback(null);
      }, (err, results) => {
        return (err) ? this.handleErrors(err) : resolve(results.filter(n => n));
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
          message: 'the OAuth access_token is not defined or empty, could not perform HTTP async requests',
          type: 'undefined-access-token-from-cache',
          function: functionName
        })
      );
    }

    if (!records.length) {
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the hold requests records array is empty',
          type: 'empty-records-array-parameter',
          function: functionName
        })
      );
    }

    if (!type || type === '') {
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the type parameter is not defined or empty',
          type: 'undefined-type-parameter',
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

    if (type === 'recap-service') {
      // return this.postRecordsToRecap(records);
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

    if (!this.areRequiredParamsValid()) {
      logger.error(
        `OAuth required parameters are not defined in function: ${functionName}`,
        { params: 'client_id, client_secret, grant_type, scope' }
      );
      return Promise.reject(HoldRequestConsumerError({
          message: 'OAuth required parameters are not defined',
          type: 'missing-constructor-oauth-required-params',
          function: functionName
        })
      );
    }

    if (!cachedToken) {
      logger.info('fetching new token from OAuth Service');
      return axios
      .post(this.oauthUrl, qs.stringify(authConfig))
      .then((response) => {
        if (response && response.data && response.data.access_token) {
          return response.data.access_token;
        }

        // We obtained a valid response. However, we could not get a value from access_token
        logger.error(`missing access_token value from OAuth Service response in function: ${functionName}`);
        return Promise.reject(HoldRequestConsumerError({
            message: 'missing access_token value from OAuth Service',
            type: 'missing-access-token-from-oauth-service',
            function: functionName
          })
        );
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
              error : {
                method: error.response.request.method,
                url: error.response.request.path,
                headers: error.response.headers,
                data: error.response.data
              }
            })
          );
        }

        if (error.request) {
          // The request was made but no response was received
          logger.error(`request was made, no response OAuth Service in function: ${functionName}`);
          return Promise.reject(HoldRequestConsumerError({
              message: 'request was made, no response from OAuth Service',
              type: 'oauth-service-error',
              function: functionName,
              error : error.request
            })
          );
        }

        logger.error(`An internal server error occurred from OAuth Service in function: ${functionName}`);
        return Promise.reject(HoldRequestConsumerError({
            message: 'An internal server error occurred',
            type: 'oauth-service-error',
            status: 500,
            function: functionName
          })
        );
      })
    } else {
      logger.info('Already obtained an access_token from CACHE, not executing call to get token from OAuth Service');
      Promise.resolve(cachedToken);
    }
  };
}

module.exports = ApiServiceHelper;
