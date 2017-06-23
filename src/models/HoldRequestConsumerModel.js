/* eslint-disable semi */
const HoldRequestConsumerError = require('./HoldRequestConsumerError');
function HoldRequestConsumerModel(records) {
  if (!(this instanceof HoldRequestConsumerModel)) {
    return new HoldRequestConsumerModel(records);
  }

  this.records = null;

  this.initialize = (records) => {
    if (typeof records === 'object' && records.length) {
      return this.setRecords(records);
    }

    throw HoldRequestConsumerError({
      message: 'the records array is not defined',
      type: 'undefined-records-array-parameter',
      function: 'HoldRequestConsumerModel.initialize'
    });
  };

  this.getRecords = () => {
    return this.records;
  };

  this.setRecords = (records) => {
    this.records = records;
  };
}

module.exports = HoldRequestConsumerModel;
