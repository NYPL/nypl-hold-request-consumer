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

    if (Array.isArray(records) && records.length > 0) {
      logger.info('filtering out decoded records with a processed flag equal to true; may result in an empty array.');

      const filteredRecords = records.filter(record => {
        if (record.processed) {
          logger.info(`filtered out hold request record (${record.id}); contains the proccessed flag set as true and has been removed from the records array for further processing`);
        }

        return !record.processed;
      });

      logger.info(`total records decoded: ${records.length}; total records to process: ${filteredRecords.length}`);

      return Promise.resolve(filteredRecords);
    }

    return Promise.reject(
        HoldRequestConsumerError({
          message: 'no records to filter; an empty array was passed.',
          type: 'empty-function-parameter',
          function: functionName
        })
    );
  }

  this.isRecordsListEmpty = (records) => {
    if (!Array.isArray(records)) {
      return true;
    }

    if (records.length === 0) {
      return true;
    }

    return false;
  }

  this.validateRemainingRecordsToProcess = (records, logMessage) => {
    const functionName = 'validateRemainingRecordsToProcess';

    if (this.isRecordsListEmpty(records)) {
      logger.notice(logMessage);

      return Promise.reject(
        HoldRequestConsumerError({
          message: logMessage,
          type: 'filtered-records-resulted-in-empty-array',
          function: functionName
        })
      );
    }

    return Promise.resolve(records);
  }
}

module.exports = HoldRequestConsumerModel;
