const partnerItem = require('./partnerItem');

module.exports = {
  id: 3232,
  jobId: '114595b9a92a674214',
  patron: '5427701',
  nyplSource: 'recap-cul',
  createdDate: '2018-09-13T12:39:02-04:00',
  updatedDate: null,
  success: false,
  processed: false,
  requestType: 'edd',
  recordType: 'i',
  record: '25094273',
  pickupLocation: 'mal',
  neededBy: '2018-01-07T02:32:51+00:00',
  numberOfCopies: 1,
  deliveryLocation: null,
  docDeliveryData: {
    emailAddress: 'user@example.com',
    chapterTitle: 'Chapter Four',
    startPage: '99',
    endPage: '109',
    author: 'Anonymous'
  },
  error: 'Item reported as not available.',
  item: partnerItem
}
