/* eslint-disable semi */
const CACHE = module.exports = {
  access_token: null,
  nypl_data_api_base_url: '',
  hold_req_schema_name: '',
  hold_req_result_stream_name: '',
  scsb_api_base_url: '',
  scsb_api_key: '',
  getAccessToken: () => {
    return CACHE.access_token;
  },
  setAccessToken: (token) => {
    CACHE.access_token = token;
  },
  getNyplDataApiBaseUrl: () => {
    return CACHE.nypl_data_api_base_url;
  },
  setNyplDataApiBaseUrl: (url) => {
    CACHE.nypl_data_api_base_url = url;
  },
  getSchemaName: () => {
    return CACHE.hold_req_schema_name;
  },
  setSchemaName: (name) => {
    CACHE.hold_req_schema_name = name;
  },
  getResultStreamName: () => {
    return CACHE.hold_req_result_stream_name;
  },
  setResultStreamName: (name) => {
    CACHE.hold_req_result_stream_name = name;
  },
  getSCSBApiBaseUrl: () => {
    return CACHE.scsb_api_base_url;
  },
  setSCSBApiBaseUrl: (url) => {
    CACHE.scsb_api_base_url = url;
  },
  getSCSBApiKey: () => {
    return CACHE.scsb_api_key;
  },
  setSCSBApiKey: (key) => {
    CACHE.scsb_api_key = key;
  }
};
