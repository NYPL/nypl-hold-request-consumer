const OnSiteHoldRequestHelper = require('./OnSiteHoldRequestHelper');
const SCSBApiHelper = require('./SCSBApiHelper');

const HoldingLocationHelper = module.exports = {
  handlePostingRecords: (records, apiData) => {
    const holdRequestRecords = records.reduce(() => {}, { scsb: [], onsite: [] });

    const scsbApiResolution = holdRequestRecords.scsb ? SCSBApiHelper.handlePostingRecords(
      holdRequestRecords.scsb,
      apiData.scsb.apiBaseUrl,
      apiData.scsb.apiKey
    ) : null;

    const onSiteHoldReqestResolution = holdRequestRecords.onsite ? OnSiteHoldRequestHelper.handlePostingRecords(
      holdRequests.onSite,
      apiData.scsc.apiBaseUrl,
      apiData.scsc.apiKey
    ) : null;

    return Promise.all([scsbApiResolution, onSiteHoldReqestResolution]);
  },
}
