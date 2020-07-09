const nyplRecapItem = require('../fixtures/nyplRecapItem')
const recapPatron = require('../fixtures/recapPatron')

const nyplRecapRecord = module.exports = {
  id: 214,
  jobId: 'be7a699a-f45e-4cf6-91d0-f080b90325be',
  patron: '6779371',
  nyplSource: 'sierra-nypl',
  createdDate: '2017-07-12T11:39:42-04:00',
  updatedDate: null,
  success: false,
  processed: false,
  requestType: 'hold',
  recordType: 'i',
  record: '10011664',
  pickupLocation: 'mal',
  neededBy: '2018-01-07T02:32:51+00:00',
  numberOfCopies: 1,
  docDeliveryData: {},
  item: nyplRecapItem,
  patronInfo: recapPatron
}
