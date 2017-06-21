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

  this.setItemApiUrlToRecord = (records, itemApiUrl) => {
    if (!itemApiUrl || itemApiUrl === '') {
      throw HoldRequestConsumerError({
        message: 'setItemApiUrlToRecord(): the itemApiUrl is not defined or empty',
        type: 'undefined-item-api-url-parameter'
      });
    }

    if (!records) {
      throw HoldRequestConsumerError({
        message: 'setItemApiUrlToRecord(): the records array is not defined',
        type: 'undefined-records-array-parameter'
      });
    }

    if (!records.length) {
      throw HoldRequestConsumerError({
        message: 'setItemApiUrlToRecord(): the records array is empty',
        type: 'empty-records-array-parameter'
      });
    }

    let fullItemUrl = itemApiUrl;

    // Iterate over the records array grouped by nyplSource
    records.map((currentItem, i) => {
      Object.keys(currentItem).forEach((key) => {
        if (!currentItem[key].hasOwnProperty('decodedData')) {
          throw HoldRequestConsumerError({
            message: 'setItemApiUrlToRecord(): the decodedData object key is not defined',
            type: 'undefined-object-property-decoded-data',
            details: currentItem[key]
          });
        }

        const arrayOfDecodedRecords = currentItem[key]['decodedData'];

        if (typeof arrayOfDecodedRecords !== 'object' && !arrayOfDecodedRecords.length) {
          throw HoldRequestConsumerError({
            message: 'setItemApiUrlToRecord(): the decodedData object is empty',
            type: 'empty-object-property-decoded-data',
            details: arrayOfDecodedRecords
          });
        }

        Object.keys(arrayOfDecodedRecords).forEach((k) => {
          // Verify the existence of the 'record' property
          if (!arrayOfDecodedRecords[k].hasOwnProperty('record')) {
            throw HoldRequestConsumerError({
              message: 'setItemApiUrlToRecord(): the record object key within decodedData is not defined',
              type: 'empty-object-property-record',
              details: arrayOfDecodedRecords[k]
            });
          }
          // Append the record value (id) to url string
          fullItemUrl += arrayOfDecodedRecords[k].record;
          // Append a comma (,) to all except the last item
          if (arrayOfDecodedRecords.length !== (parseInt(k) + 1)) {
            fullItemUrl += ',';
          }
        });

        // Append the nyplSource to the end of the string
        fullItemUrl += '&nyplSource=' + key;

        if (currentItem[key].hasOwnProperty('itemApiUrl')) {
          throw HoldRequestConsumerError({
            message: 'setItemApiUrlToRecord(): the itemApiUrl object key within decodedData already exists',
            type: 'existent-object-property-item-api-url'
          });
        }

        // Extend the source object to include the itemApiUrl
        currentItem[key]['itemApiUrl'] = fullItemUrl;
      });
    });

    return records;
  };

  this.getItemData = (records, apiUrl) => {
    // Scaffold for API Call to Item service
  };

  this.groupRecordsBy = (records, key) => {
    if (!records) {
      throw HoldRequestConsumerError({
        message: 'groupRecordsBy(): the records array is not defined',
        type: 'undefined-records-array-parameter'
      });
    }

    if (!records.length) {
      throw HoldRequestConsumerError({
        message: 'groupRecordsBy(): the records array is empty',
        type: 'empty-records-array-parameter'
      });
    }

    if (!key || key === '') {
      throw HoldRequestConsumerError({
        message: 'groupRecordsBy(): the key parameter is not defined or empty',
        type: 'undefined-key-parameter'
      });
    }

    const groupedRecordsArray = [];
    const matchingRecordsObject = records.reduce((allRecords, record) => {
      allRecords[record[key]] = allRecords[record[key]] || { 'decodedData': [] };
      allRecords[record[key]]['decodedData'].push(record);
      return allRecords;
    }, {});
    // Insert into array the grouped object
    groupedRecordsArray.push(matchingRecordsObject);

    return groupedRecordsArray;
  };

  this.getOAuthToken = (cachedToken) => {
    const authConfig = {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: this.grantType,
      scope: this.scope
    };

    if (!this.areRequiredParamsValid()) {
      return Promise.reject(HoldRequestConsumerError({
          message: 'getOAuthToken(): OAuth required parameters are not defined',
          type: 'constructor-required-params-missing'
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
            message: 'getOAuthToken(): Missing access_token value from OAuth Service',
            type: 'missing-oauth-access-token'
          })
        );
      })
      : Promise.resolve(cachedToken);
  };
}

module.exports = ApiServiceHelper;
