/* eslint-disable semi */
const async = require('async');
const axios = require('axios');
const qs = require('qs');
const HoldRequestConsumerError = require('../models/HoldRequestConsumerError');

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

  this.processGetItemDataRequests = (itemsArray, token) => {
    const functionName = 'processGetItemDataRequests';

    return new Promise((resolve, reject) => {
      async.map(itemsArray, (urlItem, cb) => {
        return axios.get(urlItem.itemApi, this.constructApiHeaders(token))
        .then(response => {
          if (response.data && response.data.data) {
            cb(null, response.data.data);
          }
        })
        .catch((error) => cb(error));
      }, (err, results) => {
        if (err) {
          let errorResponse = {
            type: 'item-service-api',
            function: functionName
          };

          if (err.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            errorResponse = HoldRequestConsumerError(Object.assign({}, errorResponse, {
              message: 'received a status outside of the 2xx range from Item Service',
              status: err.response.status,
              error : {
                method: err.response.request.method,
                url: err.response.request.path,
                headers: err.response.headers,
                data: err.response.data
              }
            }));
          } else if (err.request) {
            // The request was made but no response was received
            errorResponse = HoldRequestConsumerError(Object.assign({}, errorResponse, {
              message: 'request was made, no response from Item Service',
              status: 500,
              error : err.request
            }));
          } else {
            errorResponse = HoldRequestConsumerError(Object.assign({}, errorResponse, {
              message: err.message || 'an error occured from Item Service',
              status: 500,
              error: err,
            }));
          }
          // Reject the promise with the proper HRC Error
          reject(errorResponse);
        } else {
          // Merge two-dimensional array
          const mergedArrayResults = [].concat.apply([], results);
          resolve(mergedArrayResults);
        }
      });
    });
  };

  this.processGetPatronBarcodeRequests = (itemsArray, token, baseApiUrl) => {
    const functionName = 'processGetPatronBarcodeRequests';
    // Only require the baseApiUrl to concatenate the patronBarcodeApi
    if (!baseApiUrl || baseApiUrl === '') {
      return Promise.reject(
        HoldRequestConsumerError({
          message: `the baseApiUrl parameter is not defined or empty for type: ${type}`,
          type: 'undefined-base-api-url-parameter',
          function: functionName
        })
      );
    }

    return new Promise((resolve, reject) => {
      async.map(itemsArray, (item, callback) => {
        // Only process GET requests if the patron value is defined
        if (item.patron && item.patron !== '') {
          const patronBarcodeApi = `${baseApiUrl}patrons/${item.patron}/barcode`;
          return axios.get(patronBarcodeApi, this.constructApiHeaders(token))
          .then(response => {
            if (response.data && response.data.data) {
              item['patronInfo'] = response.data.data;
              callback(null, item);
            } else {
              callback({
                holdRequestId: item.id,
                status: 404,
                type: 'missing-response-data',
                message: 'unable to assign the patronInfo key to record. Did not obtain a response.data.data value.'
              });
            }
          })
          .catch((error) => {
            // TODO: LOG ERROR
            callback(Object.assign({}, error, { holdRequestId: item.id }));
          });
        } else {
          callback(
            HoldRequestConsumerError({
              message: 'could not generate a patron barcode API url; undefined or empty patron value',
              type: 'missing-patron-key-value',
              status: 404,
              holdRequestId: item.id,
              error : {
                data: item,
              }
            })
          );
        }
      }, (err, results) => {
        // Handle the appropriate error for each result
        if (err) {
          let errorResponse = Object.assign({}, {
            type: 'patron-service-api',
            function: functionName,
          }, err);

          if (err.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            errorResponse = HoldRequestConsumerError(Object.assign({}, errorResponse, {
              message: 'received a status outside of the 2xx range from Patron Service',
              status: err.response.status,
              error : {
                method: err.response.request.method,
                url: err.response.request.path,
                headers: err.response.headers,
                data: err.response.data
              }
            }));
          } else if (err.request) {
            // The request was made but no response was received
            errorResponse = HoldRequestConsumerError(Object.assign({}, errorResponse, {
              message: 'request was made, no response from Patron Service',
              status: 500,
              error : err.request
            }));
          } else {
            errorResponse = HoldRequestConsumerError(Object.assign({}, errorResponse, {
              message: err.message,
              status: err.status || 500,
              error: err.error
            }));
          }
          // Reject the promise with the proper HRC Error
          reject(errorResponse);
        } else {
          const mergedArrayResults = [].concat.apply([], results);
          resolve(mergedArrayResults);
        }
      });
    });
  };

  this.processBatchRequest = (itemsArray, token, type, baseApiUrl) => {
    const functionName = 'processBatchRequest';
    if (!token || token === '') {
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the token parameter is not defined or empty',
          type: 'undefined-token-parameter',
          function: functionName
        })
      );
    }

    if (!itemsArray.length) {
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the urls array parameter is empty',
          type: 'empty-urls-array-parameter',
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

    if (type === 'itemApi') {
      return this.processGetItemDataRequests(itemsArray, token);
    }

    if (type === 'patronBarcodeApi') {
      return this.processGetPatronBarcodeRequests(itemsArray, token, baseApiUrl);
    }
  };

  this.generateItemApiUrlsArray = (records, baseApiUrl) => {
    const functionName = 'generateItemApiUrlsArray';
    if (!baseApiUrl || baseApiUrl === '') {
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the baseApiUrl parameter is not defined or empty',
          type: 'undefined-base-api-url-parameter',
          function: functionName
        })
      );
    }

    if (!records) {
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the records array parameter is not defined',
          type: 'undefined-records-array-parameter',
          function: functionName
        })
      );
    }

    if (!records.length) {
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the records array parameter is empty',
          type: 'empty-records-array-parameter',
          function: functionName
        })
      );
    }

    const groupedRecords = this.groupRecordsBy(records, 'nyplSource');

    if (Object.keys(groupedRecords).length === 0) {
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the groupedRecords object is empty, could not iterate over object keys',
          type: 'empty-grouped-records-object',
          function: functionName
        })
      );
    }

    // Create the Items API URL from the base URL
    const itemApiUrlBase = `${baseApiUrl}items?id=`;
    const itemApiUrlsArray = [];
    // Store a reference that will be re-assigned and concatenated
    let itemApiUrl = itemApiUrlBase;
    // Iterate over the records object keys grouped by nyplSource
    Object.keys(groupedRecords).forEach((key) => {
      const arrayOfDecodedRecords = groupedRecords[key];

      if (typeof arrayOfDecodedRecords !== 'object' || !arrayOfDecodedRecords.length) {
        return Promise.reject(
            HoldRequestConsumerError({
            message: 'the decoded data array is empty',
            type: 'empty-decoded-data-array',
            function: functionName,
            error: { nyplSource: key, data: arrayOfDecodedRecords }
          })
        );
      }

      // Iterate over each record data to extract the record id
      Object.keys(arrayOfDecodedRecords).forEach((k) => {
        // Verify the existence of the 'record' property
        if (!arrayOfDecodedRecords[k].hasOwnProperty('record') || !arrayOfDecodedRecords[k].record) {
          return Promise.reject(
            HoldRequestConsumerError({
              message: 'the record object key within the item id is not defined',
              type: 'empty-object-property-record',
              function: functionName,
              error: { nyplSource: key, data: arrayOfDecodedRecords[k] }
            })
          );
        }

        // Append the record value (id) to url string
        itemApiUrl += arrayOfDecodedRecords[k].record;

        // Append a comma (,) to all except the last item
        if (arrayOfDecodedRecords.length !== (parseInt(k) + 1)) {
          itemApiUrl += ',';
        }
      });
      // Append the nyplSource to the end of the string
      itemApiUrl += '&nyplSource=' + key;
      // Add the Item API Url and data to final array
      itemApiUrlsArray.push({
        'nyplSource': key,
        'itemApi': itemApiUrl,
        'data': arrayOfDecodedRecords
      });
      // Reset the item URL for the next record
      itemApiUrl = itemApiUrlBase;
    });

    return Promise.resolve(itemApiUrlsArray);
  };

  this.groupRecordsBy = (records, key) => {
    const functionName = 'groupRecordsBy';

    if (!records) {
      throw HoldRequestConsumerError({
        message: 'the records array is not defined',
        type: 'undefined-records-array-parameter',
        function: functionName
      });
    }

    if (!records.length) {
      throw HoldRequestConsumerError({
        message: 'the records array is empty',
        type: 'empty-records-array-parameter',
        function: functionName
      });
    }

    if (!key || key === '') {
      throw HoldRequestConsumerError({
        message: 'the key parameter is not defined or empty',
        type: 'undefined-key-parameter',
        function: functionName
      });
    }

    const matchingRecordsObject = records.reduce((allRecords, record) => {
      allRecords[record[key]] = allRecords[record[key]] || [];
      allRecords[record[key]].push(record);
      return allRecords;
    }, {});

    return matchingRecordsObject;
  };

  this.getOAuthToken = (cachedToken) => {
    const functionName = 'getOAuthToken';
    const authConfig = {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: this.grantType,
      scope: this.scope
    };

    if (!this.areRequiredParamsValid()) {
      return Promise.reject(HoldRequestConsumerError({
          message: 'OAuth required parameters are not defined',
          type: 'missing-constructor-required-params',
          function: functionName
        })
      );
    }

    return (!cachedToken) ? axios
      .post(this.oauthUrl, qs.stringify(authConfig))
      .then((response) => {
        if (response && response.data && response.data.access_token) {
          return response.data.access_token;
        }

        // We obtained a valid response. However, we could not get a value from access_token
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
          return Promise.reject(HoldRequestConsumerError({
              message: 'request was made, no response from OAuth Service',
              type: 'oauth-service-error',
              status: 500,
              function: functionName,
              error : error.request
            })
          );
        }

        return Promise.reject(HoldRequestConsumerError({
            message: error.message,
            type: 'oauth-service-error',
            status: 500,
            function: functionName
          })
        );
      })
      : Promise.resolve(cachedToken);
  };
}

module.exports = ApiServiceHelper;
