/* eslint-disable semi */
const HoldRequestConsumerError = require('./HoldRequestConsumerError');

function HoldRequestConsumerModel() {
  if (!(this instanceof HoldRequestConsumerModel)) {
    return new HoldRequestConsumerModel();
  }

  this.records = null;

  this.getRecords = () => {
    return this.records;
  };

  this.setRecords = (records) => {
    this.records = records;
  };
}

module.exports = HoldRequestConsumerModel;
