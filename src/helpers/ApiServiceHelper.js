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
