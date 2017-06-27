/* eslint-disable semi */
const _ = require('lodash');
const HoldRequestConsumerError = require('./HoldRequestConsumerError');
function HoldRequestConsumerModel(records) {
  if (!(this instanceof HoldRequestConsumerModel)) {
    return new HoldRequestConsumerModel(records);
  }

  this.records = null;
  this.apiUrlsArray = null;

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

  this.getApiUrlsArray = () => {
    return this.apiUrlsArray;
  };

  this.setApiUrlsArray = (urlsArray) => {
    this.apiUrlsArray = urlsArray;
  };

  this.mergeRecordsBySourceAndRecordId = (initialRecords, updatedRecords) => {
    const functionName = 'mergeRecordsBySourceAndRecordId';

    if (!initialRecords.length) {
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the initialRecords array parameter is empty',
          type: 'empty-initial-records-array-parameter',
          function: functionName
        })
      );
    }

    if (!updatedRecords.length) {
      return Promise.reject(
        HoldRequestConsumerError({
          message: 'the updatedRecords array parameter is empty',
          type: 'empty-updated-records-array-parameter',
          function: functionName
        })
      );
    }

    const mergedRecords = _.map(initialRecords, function(item) {
      const matchedRecord = _.find(updatedRecords, { id: item.record, nyplSource: item.nyplSource });
      return _.extend(item, { 'item': matchedRecord });
    });

    return mergedRecords && mergedRecords.length ? Promise.resolve(mergedRecords)
      : Promise.reject(HoldRequestConsumerError({
        message: 'the mergedRecords array is could not be generated while attempting to merge by nyplSource and record id',
        type: 'undefined-merged-records-array',
        function: functionName
      }));
  };
}

module.exports = HoldRequestConsumerModel;
