/* eslint-disable semi */
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const expect = chai.expect;
const HoldRequestConsumerModel = require('../../src/models/HoldRequestConsumerModel.js');
chai.should();
chai.use(chaiAsPromised);

describe('HoldRequestConsumer Lambda: HoldRequestConsumeModel Factory', () => {
  const hrcModel = new HoldRequestConsumerModel();

  describe('Instance Defaults', () => {
    it('should initialize the records instance property to null', () => {
      expect(hrcModel.records).to.equal(null);
    });
  });

  describe('getRecords() function', () => {
    it('should return the records instance property value (null) when no setter has been called', () => {
      return expect(hrcModel.getRecords()).to.equal(null);
    });

    it('should return the records instance property value (array) when the setter has been called', () => {
      const dummyRecordsTest = ['test', 'test'];
      hrcModel.setRecords(dummyRecordsTest);
      expect(hrcModel.getRecords()).to.equal(dummyRecordsTest);
    });
  });

  describe('setRecords(array) function', () => {
    it('should save the records array to the instance records property', () => {
      const dummyRecords = [
        {
          id: 216,
          jobId: '86a40625-53b7-43e3-9c95-e0a0f290f614',
          patron: '6779366',
          nyplSource: 'sierra-nypl',
          createdDate: '2017-07-12T11:47:11-04:00',
          updatedDate: null,
          success: false,
          processed: false,
          requestType: 'hold',
          recordType: 'i',
          record: '13153327',
          pickupLocation: 'mal',
          neededBy: '2018-01-07T02:32:51+00:00',
          numberOfCopies: 1,
          deliveryLocation: null,
          docDeliveryData: null
        },
        {
          id: 217,
          jobId: 'c1cb5981-bcd8-4d3a-873c-ae580f683cd1',
          patron: '6779366',
          nyplSource: 'sierra-nypl',
          createdDate: '2017-07-12T11:48:01-04:00',
          updatedDate: null,
          success: false,
          processed: false,
          requestType: 'hold',
          recordType: 'i',
          record: '11064288',
          pickupLocation: 'mal',
          neededBy: '2018-01-07T02:32:51+00:00',
          numberOfCopies: 1,
          deliveryLocation: null,
          docDeliveryData: null
        }
      ];

      hrcModel.setRecords(dummyRecords);

      return expect(hrcModel.records).to.equal(dummyRecords);
    });
  });

  describe('filterProcessedRecords(array) function', () => {
    it('should reject with an error if the records array parameter is an empty array', () => {
      const result = hrcModel.filterProcessedRecords([]);
      return result.should.be.rejected.and.eventually.have.property('errorMessage', 'no records to filter; an empty array was passed.');
    });

    it('should reject with an error if the records array parameter is an empty object', () => {
      const result = hrcModel.filterProcessedRecords({});
      return result.should.be.rejected.and.eventually.have.property('errorMessage', 'no records to filter; an empty array was passed.');
    });

    it('should return an empty array when all elements contain the processed flas set to TRUE', () => {
      const dummyRecords = [
        {
          id: 216,
          jobId: '86a40625-53b7-43e3-9c95-e0a0f290f614',
          patron: '6779366',
          nyplSource: 'sierra-nypl',
          createdDate: '2017-07-12T11:47:11-04:00',
          updatedDate: null,
          success: false,
          processed: true,
          requestType: 'hold',
          recordType: 'i',
          record: '13153327',
          pickupLocation: 'mal',
          neededBy: '2018-01-07T02:32:51+00:00',
          numberOfCopies: 1,
          deliveryLocation: null,
          docDeliveryData: null
        },
        {
          id: 217,
          jobId: 'c1cb5981-bcd8-4d3a-873c-ae580f683cd1',
          patron: '6779366',
          nyplSource: 'sierra-nypl',
          createdDate: '2017-07-12T11:48:01-04:00',
          updatedDate: null,
          success: false,
          processed: true,
          requestType: 'hold',
          recordType: 'i',
          record: '11064288',
          pickupLocation: 'mal',
          neededBy: '2018-01-07T02:32:51+00:00',
          numberOfCopies: 1,
          deliveryLocation: null,
          docDeliveryData: null
        }
      ];

      const result = hrcModel.filterProcessedRecords(dummyRecords);

      return result.should.be.fulfilled.and.eventually.be.an('array').that.is.empty;
    });

    it('should remove array elements who contain the processed boolean set to TRUE', () => {
      const dummyRecords = [
        {
          id: 216,
          jobId: '86a40625-53b7-43e3-9c95-e0a0f290f614',
          patron: '6779366',
          nyplSource: 'sierra-nypl',
          createdDate: '2017-07-12T11:47:11-04:00',
          updatedDate: null,
          success: false,
          processed: true,
          requestType: 'hold',
          recordType: 'i',
          record: '13153327',
          pickupLocation: 'mal',
          neededBy: '2018-01-07T02:32:51+00:00',
          numberOfCopies: 1,
          deliveryLocation: null,
          docDeliveryData: null
        },
        {
          id: 217,
          jobId: 'c1cb5981-bcd8-4d3a-873c-ae580f683cd1',
          patron: '6779366',
          nyplSource: 'sierra-nypl',
          createdDate: '2017-07-12T11:48:01-04:00',
          updatedDate: null,
          success: false,
          processed: false,
          requestType: 'hold',
          recordType: 'i',
          record: '11064288',
          pickupLocation: 'mal',
          neededBy: '2018-01-07T02:32:51+00:00',
          numberOfCopies: 1,
          deliveryLocation: null,
          docDeliveryData: null
        }
      ];

      const result = hrcModel.filterProcessedRecords(dummyRecords);

      return result.should.be.fulfilled.and.eventually.be.an('array').that.includes(dummyRecords[1]);
    });
  });

  describe('filterScsbUiRecords(array) function', () => {
    it('should reject with an error if the records array parameter is an empty array', () => {
      const result = hrcModel.filterScsbUiRecords([]);
      return result.should.be.rejected.and.eventually.have.property('errorMessage', 'no records to filter; an empty array was passed.');
    });

    it('should reject with an error if the records array parameter is an empty object', () => {
      const result = hrcModel.filterScsbUiRecords({});
      return result.should.be.rejected.and.eventually.have.property('errorMessage', 'no records to filter; an empty array was passed.');
    });

    it('should return an empty array when all records contain deliveryLocation key and value', () => {
      const dummyRecords = [
        {
          id: 216,
          jobId: '86a40625-53b7-43e3-9c95-e0a0f290f614',
          patron: '6779366',
          nyplSource: 'sierra-nypl',
          createdDate: '2017-07-12T11:47:11-04:00',
          updatedDate: null,
          success: false,
          processed: false,
          requestType: 'hold',
          recordType: 'i',
          record: '13153327',
          pickupLocation: 'mal',
          neededBy: '2018-01-07T02:32:51+00:00',
          numberOfCopies: 1,
          deliveryLocation: 'mal',
          docDeliveryData: null
        },
        {
          id: 217,
          jobId: 'c1cb5981-bcd8-4d3a-873c-ae580f683cd1',
          patron: '6779366',
          nyplSource: 'sierra-nypl',
          createdDate: '2017-07-12T11:48:01-04:00',
          updatedDate: null,
          success: false,
          processed: false,
          requestType: 'hold',
          recordType: 'i',
          record: '11064288',
          pickupLocation: 'mal',
          neededBy: '2018-01-07T02:32:51+00:00',
          numberOfCopies: 1,
          deliveryLocation: '',
          docDeliveryData: null
        }
      ];

      const result = hrcModel.filterScsbUiRecords(dummyRecords);

      return result.should.be.fulfilled.and.eventually.be.an('array').that.is.empty;
    });

    it('should remove array elements who contain the deliveryLocation key and value defined', () => {
      const dummyRecords = [
        {
          id: 216,
          jobId: '86a40625-53b7-43e3-9c95-e0a0f290f614',
          patron: '6779366',
          nyplSource: 'sierra-nypl',
          createdDate: '2017-07-12T11:47:11-04:00',
          updatedDate: null,
          success: false,
          processed: false,
          requestType: 'hold',
          recordType: 'i',
          record: '13153327',
          pickupLocation: 'mal',
          neededBy: '2018-01-07T02:32:51+00:00',
          numberOfCopies: 1,
          deliveryLocation: 'mal',
          docDeliveryData: null
        },
        {
          id: 217,
          jobId: 'c1cb5981-bcd8-4d3a-873c-ae580f683cd1',
          patron: '6779366',
          nyplSource: 'sierra-nypl',
          createdDate: '2017-07-12T11:48:01-04:00',
          updatedDate: null,
          success: false,
          processed: false,
          requestType: 'hold',
          recordType: 'i',
          record: '11064288',
          pickupLocation: 'mal',
          neededBy: '2018-01-07T02:32:51+00:00',
          numberOfCopies: 1,
          deliveryLocation: null,
          docDeliveryData: null
        }
      ];

      const result = hrcModel.filterScsbUiRecords(dummyRecords);

      return result.should.be.fulfilled.and.eventually.be.an('array').that.includes(dummyRecords[1]);
    });
  });

  describe('isRecordsListEmpty(array) function', () => {
    it('should return false if an array contains elements', () => {
      return expect(hrcModel.isRecordsListEmpty(['test'])).to.equal(false);
    });

    it('should return false if the passed array parameter is NOT of type array', () => {
      return expect(hrcModel.isRecordsListEmpty({})).to.equal(false);
    });

    it('should return true if the passed array parameter has no elements', () => {
      return expect(hrcModel.isRecordsListEmpty([])).to.equal(true);
    });
  });

  describe('validateRemainingRecordsToProcess(array) function', () => {
    it('should reject the promise if the array parameter is empty', () => {
      const result = hrcModel.validateRemainingRecordsToProcess([]);

      return result.should.be.rejected.and.eventually.have.property('errorType', 'filtered-records-resulted-in-empty-array');
    });

    it('should fulfill the promise if the array parameter is not empty', () => {
      const result = hrcModel.validateRemainingRecordsToProcess(['test']);

      return result.should.be.fulfilled.and.eventually.be.an('array').that.includes('test');
    });
  });
});
