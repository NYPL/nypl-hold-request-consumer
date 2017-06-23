/* eslint-disable semi */
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

  this.generateRecordApiUrlsArray = (records, baseApiUrl) => {
    const functionName = 'setItemApiUrlToRecord';
    if (!baseApiUrl || baseApiUrl === '') {
      throw HoldRequestConsumerError({
        message: 'the baseApiUrl parameter is not defined or empty',
        type: 'undefined-item-api-url-parameter',
        function: functionName
      });
    }

    if (!records) {
      throw HoldRequestConsumerError({
        message: 'the records object parameter is not defined',
        type: 'undefined-records-object-parameter',
        function: functionName
      });
    }

    if (Object.keys(records).length === 0) {
      throw HoldRequestConsumerError({
        message: 'the records object parameter is empty, could not iterate over object keys',
        type: 'empty-records-object-parameter',
        function: functionName
      });
    }

    // Create the Items API URL from the base URL
    const itemApiUrlBase = `${baseApiUrl}items?id=`;
    const patronBarcodeApiUrlBase = `${baseApiUrl}patrons`;
    const itemApiUrlsArray = [];
    // Store a reference that will be re-assigned and concatenated
    let itemApiUrl = itemApiUrlBase;
    let patronBarcodeApiUrl = '';
    // Iterate over the records object keys grouped by nyplSource
    Object.keys(records).forEach((key) => {
      const arrayOfDecodedRecords = records[key];

      if (typeof arrayOfDecodedRecords !== 'object' || !arrayOfDecodedRecords.length) {
        throw HoldRequestConsumerError({
          message: 'the decoded data array is empty',
          type: 'empty-decoded-data-array',
          function: functionName,
          error: { nyplSource: key, data: arrayOfDecodedRecords }
        });
      }

      // Iterate over each record data to extract the record id
      Object.keys(arrayOfDecodedRecords).forEach((k) => {
        // Verify the existence of the 'record' property
        if (!arrayOfDecodedRecords[k].hasOwnProperty('record') || !arrayOfDecodedRecords[k].record) {
          throw HoldRequestConsumerError({
            message: 'the record object key within the item id is not defined',
            type: 'empty-object-property-record',
            function: functionName,
            error: { nyplSource: key, data: arrayOfDecodedRecords[k] }
          });
        }

        // Verify the existence of the 'record' property
        if (!arrayOfDecodedRecords[k].hasOwnProperty('patron') || !arrayOfDecodedRecords[k].patron) {
          throw HoldRequestConsumerError({
            message: 'the patron object key within the patron id is not defined',
            type: 'empty-object-property-patron',
            function: functionName,
            error: { nyplSource: key, data: arrayOfDecodedRecords[k] }
          });
        }
        // Generate patron barcode url
        patronBarcodeApiUrl = `${patronBarcodeApiUrlBase}/${arrayOfDecodedRecords[k].patron}/barcode`;

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
        'itemApiUrl': itemApiUrl,
        'patronBarcodeApiUrl': patronBarcodeApiUrl,
        'data': arrayOfDecodedRecords
      });
      // Reset the item URL for the next record
      itemApiUrl = itemApiUrlBase;
    });

    return itemApiUrlsArray;
  };

  this.getItemData = (records, apiUrl) => {
    // Scaffold for API Call to Item service
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
              error : { headers: error.response.headers, data: error.response.data }
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
