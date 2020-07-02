const OnSiteHoldRequestHelper = module.exports = {
  handlePostingRecords: (records, apiData) => {
    const requests = records.map(OnSiteHoldRequestHelper.generateModel);
    console.log(apiData);
    return apiData.apiHelper.handleHttpAsyncRequests(
      requests,
      'on-site-hold-request-service',
      apiData.apiBaseUrl,
      apiData.apiKey
    )
  },
  generateModel: ({
    patron,
    nyplSource,
    record,
    pickupLocation,
    neededBy,
    numberOfCopies,
    docDeliveryData
  }) => {
    return {
      patron,
      nyplSource,
      record,
      pickupLocation,
      neededBy,
      numberOfCopies,
      docDeliveryData
    };
  }
}
