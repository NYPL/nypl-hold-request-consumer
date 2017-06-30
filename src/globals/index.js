const CACHE = module.exports = {
  access_token: null,
  nypl_data_api_base: '',
  schema_name: '',
  getAccessToken: function() {
    return CACHE.access_token;
  },
  setAccessToken: function(token) {
    CACHE.access_token = token;
  },
  getNyplDataApiBase: function() {
    return CACHE.nypl_data_api_base;
  },
  setNyplDataApiBase: function(url) {
    CACHE.nypl_data_api_base = url;
  },
  getSchemaName: function() {
    return CACHE.schema_name;
  },
  setSchemaName: function(name) {
    CACHE.schema_name = name;
  }
};
