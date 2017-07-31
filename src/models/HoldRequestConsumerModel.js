/* eslint-disable semi */
const logger = require('../helpers/Logger');
const HoldRequestConsumerError = require('../models/HoldRequestConsumerError');

function HoldRequestConsumerModel () {
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

  this.filterProcessedRecords = (records) => {
    const functionName = 'filterProcessedRecords';

    if (!records.length) {
      return Promise.reject(
          HoldRequestConsumerError({
            message: 'no records to filter; an empty array was passed.',
            type: 'empty-function-parameter',
            function: functionName
          })
      );
    }

    logger.info('filtering out decoded records with a processed flag equal to true; may result in an empty array.');
    const filteredRecords = records.filter(record => record.processed === false);

    logger.info(`total records decoded: ${records.length}; total records to process: ${filteredRecords.length}`);
    if (filteredRecords.length === 0) {
      return Promise.reject(
          HoldRequestConsumerError({
            message: 'the filtered records array is empty; all records contained the proccessed flag equal to true',
            type: 'empty-filtered-records',
            function: functionName,
            error: records
          })
      );
    }

    return Promise.resolve(filteredRecords);
  }
}

module.exports = HoldRequestConsumerModel;
