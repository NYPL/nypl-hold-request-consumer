const OnSiteHoldRequestHelper = require('../helpers/OnSiteHoldRequestHelper')
const SCSBApiHelper = require('../helpers/SCSBApiHelper')
const logger = require('../helpers/Logger')

module.exports = {
  handlePostingRecords: (records, apiData) => {
    const holdRequestRecords = records.reduce((records, record) => {
      (/^rc/i.test(record.item.location.code))
      ? records.scsb.push(record) : records.onSite.push(record)

      return records
    }, { scsb: [], onSite: [] })
    const resolutions = []
    logger.info(`sorted records into on-site holds and ReCAP holds.`, {
      totalRecords: records.length,
      numScsbHoldRequests: holdRequestRecords.scsb.length,
      numOnSiteHoldRequests: holdRequestRecords.onSite.length
    })

    if (holdRequestRecords.scsb.length) {
      const scsbApiResolution = SCSBApiHelper.handlePostingRecords(
        holdRequestRecords.scsb,
        apiData.scsb.apiBaseUrl,
        apiData.scsb.apiKey
      )
      resolutions.push(scsbApiResolution)
    };

    if (holdRequestRecords.onSite.length) {
      const onSiteHoldRequestResolution = OnSiteHoldRequestHelper.handlePostingRecords(
        holdRequestRecords.onSite,
        apiData.onSite
      )
      resolutions.push(onSiteHoldRequestResolution)
    };

    return Promise.all(resolutions)
      .then(resolutions => {
        const [scsbResolution, onSiteHoldRequestResolution] = resolutions
        return [...scsbResolution, ...onSiteHoldRequestResolution]
      })
      .catch(resolutions => {
        const [scsbResolution, onSiteHoldRequestResolution] = resolutions
        return [...scsbResolution, ...onSiteHoldRequestResolution]
      })
  }
}
