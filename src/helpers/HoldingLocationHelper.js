const OnSiteHoldRequestHelper = require('./OnSiteHoldRequestHelper');
const SCSBApiHelper = require('./SCSBApiHelper');

const HoldingLocationHelper = module.exports = {
  handlePostingRecords: (records, apiData) => {
    const holdRequestRecords = records.reduce((records, record) => {
      (/^rc/i.test(record.item.location.code)) ?
      records.scsb.push(record) : records.onSite.push(record);

      return records;
    }, { scsb: [], onSite: [] });
    const resolutions = [];
    console.log("holdRequestRecords", holdRequestRecords);

    if (holdRequestRecords.scsb.length) {
      const scsbApiResolution = SCSBApiHelper.handlePostingRecords(
        holdRequestRecords.scsb,
        apiData.scsb.apiBaseUrl,
        apiData.scsb.apiKey
      );
      resolutions.push(scsbApiResolution);
    };

    if (holdRequestRecords.onSite.length) {
      const onSiteHoldRequestResolution = OnSiteHoldRequestHelper.handlePostingRecords(
        holdRequestRecords.onSite,
        apiData.onSite
      );
      resolutions.push(onSiteHoldRequestResolution);
    };

    return Promise.all(resolutions);
  },
}
