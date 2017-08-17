/* eslint-disable semi */
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const SCSBApiHelper = require('../../src/helpers/SCSBApiHelper.js');
const expect = chai.expect;
chai.should();
chai.use(chaiAsPromised);

describe('HoldRequestConsumer Lambda: SCSB API Helper', () => {

  describe('handlePostingRecordsToSCSBApi() function', () => {
    const handlePostingRecordsToSCSBApi = SCSBApiHelper.handlePostingRecordsToSCSBApi;

    it('should reject with a HoldRequestConsumerError if the records array parameter is NULL', () => {
      const result = handlePostingRecordsToSCSBApi(null, 'apiBaseUrl', 'apiKey');
      return result.should.be.rejected.and.eventually.have.property('errorType', 'undefined-records-array-parameter');
    });

    it('should reject with a HoldRequestConsumerError if the records array parameter is UNDEFINED', () => {
      const result = handlePostingRecordsToSCSBApi(undefined, 'apiBaseUrl', 'apiKey');
      return result.should.be.rejected.and.eventually.have.property('errorType', 'undefined-records-array-parameter');
    });

    it('should reject with a HoldRequestConsumerError if the records array parameter is an EMPTY Object', () => {
      const result = handlePostingRecordsToSCSBApi({}, 'apiBaseUrl', 'apiKey');
      return result.should.be.rejected.and.eventually.have.property('errorType', 'undefined-records-array-parameter');
    });

    it('should reject with a HoldRequestConsumerError if the records array parameter is an EMPTY Array', () => {
      const result = handlePostingRecordsToSCSBApi([], 'apiBaseUrl', 'apiKey');
      return result.should.be.rejected.and.eventually.have.property('errorType', 'empty-records-array');
    });

    it('should reject with a HoldRequestConsumerError if the scsbApiBaseUrl parameter is NULL', () => {
      const result = handlePostingRecordsToSCSBApi([{ id: 'holdId' }], null, 'apiKey');
      return result.should.be.rejected.and.eventually.have.property('errorType', 'undefined-function-parameter');
    });

    it('should reject with a HoldRequestConsumerError if the scsbApiBaseUrl parameter is UNDEFINED', () => {
      const result = handlePostingRecordsToSCSBApi([{ id: 'holdId' }], undefined, 'apiKey');
      return result.should.be.rejected.and.eventually.have.property('errorType', 'undefined-function-parameter');
    });

    it('should reject with a HoldRequestConsumerError if the scsbApiBaseUrl parameter is an EMPTY String', () => {
      const result = handlePostingRecordsToSCSBApi([{ id: 'holdId' }], '', 'apiKey');
      return result.should.be.rejected.and.eventually.have.property('errorMessage', 'the SCSB API base url parameter is not defined; unable to instantiate SCSB Rest Client');
    });

    it('should reject with a HoldRequestConsumerError if the scsbApiKey parameter is NULL', () => {
      const result = handlePostingRecordsToSCSBApi([{ id: 'holdId' }], 'scsbApiBaseUrl', null);
      return result.should.be.rejected.and.eventually.have.property('errorType', 'undefined-function-parameter');
    });

    it('should reject with a HoldRequestConsumerError if the scsbApiKey parameter is UNDEFINED', () => {
      const result = handlePostingRecordsToSCSBApi([{ id: 'holdId' }], 'scsbApiBaseUrl', undefined);
      return result.should.be.rejected.and.eventually.have.property('errorType', 'undefined-function-parameter');
    });

    it('should reject with a HoldRequestConsumerError if the scsbApiKey parameter is an EMPTY String', () => {
      const result = handlePostingRecordsToSCSBApi([{ id: 'holdId' }], 'scsbApiBaseUrl', '');
      return result.should.be.rejected.and.eventually.have.property('errorMessage', 'the SCSB API key parameter is not defined; unable to instantiate SCSB Rest Client');
    });
  });

  describe('getSCSBDebugInfo() function', () => {
    const getSCSBDebugInfo = SCSBApiHelper.getSCSBDebugInfo;

    it('should return an EMPTY Object if the response object parameter is not declared', () => {
      const result = getSCSBDebugInfo();
      return expect(result).to.be.an('object').and.to.eql({});
    });

    it('should return an EMPTY Object if the response object parameter is an EMPTY object', () => {
      const result = getSCSBDebugInfo({});
      return expect(result).to.be.an('object').and.to.eql({});
    });

    it('should return an object with a single property if the response.success was passed with FALSE boolean', () => {
      const result = getSCSBDebugInfo({ 'success': false });
      return expect(result).to.be.an('object').and.to.eql({ 'success': false });
    });

    it('should return an object with a single property if the response.success was passed with TRUE boolean', () => {
      const result = getSCSBDebugInfo({ 'success': true });
      return expect(result).to.be.an('object').and.to.eql({ 'success': true });
    });
  });
});
