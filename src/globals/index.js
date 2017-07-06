const CACHE = module.exports = {
  access_token: null,
  nypl_data_api_base: '',
  hold_req_schema_name: '',
  hold_req_results_stream_name: '',
  getAccessToken: () => {
    return CACHE.access_token;
  },
  setAccessToken: (token) => {
    CACHE.access_token = token;
  },
  getNyplDataApiBase: () => {
    return CACHE.nypl_data_api_base;
  },
  setNyplDataApiBase: (url) => {
    CACHE.nypl_data_api_base = url;
  },
  getSchemaName: () => {
    return CACHE.hold_req_schema_name;
  },
  setSchemaName: (name) => {
    CACHE.hold_req_schema_name = name;
  },
  getResultsStreamName: () => {
    return CACHE.hold_req_results_stream_name;
  },
  setResultsStreamName: (name) => {
    CACHE.hold_req_results_stream_name = name;
  }
};
