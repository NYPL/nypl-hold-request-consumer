const OnSiteHoldRequestHelper = require('./OnSiteHoldRequestHelper')
const SCSBApiHelper = require('./SCSBApiHelper')
const logger = require('./Logger')

const HoldRequestDispatcher = module.exports = {
  dispatchRecords: (records, apiData = { scsb: {}, onSite: {} }) => {
    // sort records by holding location- either ReCAP/SCSB or on-site
    const holdRequestRecords = HoldRequestDispatcher.sortRecords(records)
    const resolutions = []
    logger.info(`sorted records into on-site holds and ReCAP holds.`, {
      totalRecords: records.length,
      numScsbHoldRequests: holdRequestRecords.scsb.length,
      numOnSiteHoldRequests: holdRequestRecords.onSite.length
    })
    let scsbApiResolution = Promise.resolve([]);
    if (holdRequestRecords.scsb.length) {
      scsbApiResolution = SCSBApiHelper.handlePostingRecords(
        holdRequestRecords.scsb,
        apiData.scsb.apiBaseUrl,
        apiData.scsb.apiKey
      )
    };
    resolutions.push(scsbApiResolution)

    let onSiteHoldRequestResolution = Promise.resolve([]);
    if (holdRequestRecords.onSite.length) {
      onSiteHoldRequestResolution = OnSiteHoldRequestHelper.handlePostingRecords(
        holdRequestRecords.onSite,
        apiData.onSite
      )
    };
    resolutions.push(onSiteHoldRequestResolution)

    return Promise.all(resolutions)
      .then(resolutions => {
        const [scsbResolution, onSiteHoldRequestResolution] = resolutions
        return [...scsbResolution, ...onSiteHoldRequestResolution]
      })
      .catch(resolutions => {
        const [scsbResolution, onSiteHoldRequestResolution] = resolutions
        return [...scsbResolution, ...onSiteHoldRequestResolution]
      })
  },
  sortRecords: (records) => records.reduce((records, record) => {
    (/^rc/i.test(record.item.location.code))
    ? records.scsb.push(record) : records.onSite.push(record)

    return records
  }, { scsb: [], onSite: [] })
}
