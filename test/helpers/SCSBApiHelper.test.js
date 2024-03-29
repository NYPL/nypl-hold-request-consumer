/* eslint-disable semi */
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const expect = chai.expect;
const sinon = require('sinon')

const SCSBApiHelper = require('../../src/helpers/SCSBApiHelper.js');
const nyplRecapRecord = require('../fixtures/nyplRecapRequest')

require('dotenv').config({ path: '../../config/test.env' });

chai.should();
chai.use(chaiAsPromised);

describe('HoldRequestConsumer Lambda: SCSB API Helper', () => {
  const SCSBRestClient = require('@nypl/scsb-rest-client');

  before(() => {
    process.env.SCSB_API_BASE_URL = 'https://example.com'
    process.env.SCSB_API_KEY = 'super-secret-fake-key'

    sinon.stub(SCSBRestClient.prototype, 'addRequestItem').callsFake(function () {
      return Promise.resolve({ success: true })
    })
  })

  after(() => {
    SCSBRestClient.prototype.addRequestItem.restore()
  })

  describe('handlePostingRecords() function', () => {
    const handlePostingRecordsToSCSBApi = SCSBApiHelper.handlePostingRecords;

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

    it('should validate all required parameters and execute a successful POST request to the SCSB API', () => {
      const testRecords = [ nyplRecapRecord ];
      const result = handlePostingRecordsToSCSBApi(testRecords, process.env.SCSB_API_BASE_URL, process.env.SCSB_API_KEY)
      return result.should.be.fulfilled;
    });
  });

  describe('getSCSBDebugInfo(object) function', () => {
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
      const result = getSCSBDebugInfo({ success: false });
      return expect(result).to.be.an('object').and.to.eql({ 'success': false });
    });

    it('should return an object with a single property if the response.success was passed with TRUE boolean', () => {
      const result = getSCSBDebugInfo({ success: true });
      return expect(result).to.be.an('object').and.to.eql({ 'success': true });
    });

    it('should return an object with matching parameter object properties to include response.success set to TRUE', () => {
      const result = getSCSBDebugInfo({
        success: true,
        screenMessage: 'example screenMessage',
        requestType: 'reqType example',
        requestingInstitution: 'ex requestingInstitution',
        deliveryLocation: 'MAL',
        itemBarcodes: ['1010101']
      });

      return expect(result).to.be.an('object').and.to.eql({
        success: true,
        screenMessage: 'example screenMessage',
        requestType: 'reqType example',
        requestingInstitution: 'ex requestingInstitution',
        deliveryLocation: 'MAL',
        itemBarcodes: ['1010101']
      });
    });

    it('should return an object with matching parameter object properties to include response.success set to FALSE', () => {
      const result = getSCSBDebugInfo({
        success: false,
        screenMessage: 'example screenMessage',
        requestType: 'reqType example',
        requestingInstitution: 'ex requestingInstitution',
        deliveryLocation: 'MAL',
        itemBarcodes: ['1010101']
      });

      return expect(result).to.be.an('object').and.to.eql({
        success: false,
        screenMessage: 'example screenMessage',
        requestType: 'reqType example',
        requestingInstitution: 'ex requestingInstitution',
        deliveryLocation: 'MAL',
        itemBarcodes: ['1010101']
      });
    });
  });

  describe('getInstitutionCode(string) function', () => {
    const getInstitutionCode = SCSBApiHelper.getInstitutionCode;

    it('should return undefined if no code string type was passed as a function parameter', () => {
      const result = getInstitutionCode();
      const result2 = getInstitutionCode(null);

      expect(result2).to.be.undefined;
      expect(result).to.be.undefined;
    });

    it('should return undefined if an empty string code was passed', () => {
      const result = getInstitutionCode('');

      return expect(result).to.be.undefined;
    });

    it('should return undefined if a non-matching code was passed', () => {
      const result = getInstitutionCode('PHEW');

      return expect(result).to.be.undefined;
    });

    it('should return a matching institution code if recap-cul passed', () => {
      const result = getInstitutionCode('recap-cul');

      return expect(result).to.eql('CUL');
    });

    it('should return a matching institution code if recap-pul passed', () => {
      const result = getInstitutionCode('recap-pul');

      return expect(result).to.eql('PUL');
    });

    it('should return a matching institution code if sierra-nypl passed', () => {
      const result = getInstitutionCode('sierra-nypl');

      return expect(result).to.eql('NYPL');
    });

    it('should return a matching institution code if recap-hl passed', () => {
      const result = getInstitutionCode('recap-hl');

      return expect(result).to.eql('HL');
    });
  });

  describe('generateSCSBModel(object) function', () => {
    const generateSCSBModel = SCSBApiHelper.generateSCSBModel;

    it('should return an object with NYPL as a requestingInstitution if no object is passed', () => {
      const result = generateSCSBModel();

      return expect(result).to.eql({ requestingInstitution: 'NYPL' });
    });

    it('should return an object with NYPL as a requestingInstitution and requestType EDD if the requestType edd was passed', () => {
      const result = generateSCSBModel({ requestType: 'edd' });

      return expect(result).to.eql({ requestingInstitution: 'NYPL', requestType: 'EDD' });
    });

    it('should return an object with NYPL as a requestingInstitution and requestType RETRIEVAL if the requestType hold was passed', () => {
      const result = generateSCSBModel({ requestType: 'hold' });

      return expect(result).to.eql({ requestingInstitution: 'NYPL', requestType: 'RETRIEVAL' });
    });

    it('should return an object with NYPL as a requestingInstitution and requestType TEST if the requestType test was passed', () => {
      const result = generateSCSBModel({ requestType: 'test' });

      return expect(result).to.eql({ requestingInstitution: 'NYPL', requestType: 'TEST' });
    });

    it('should return an object with properties (requestingInstitution, requestType and itemOwningInstitution) if requestType is edd and nyplSource is recap-pul', () => {
      const result = generateSCSBModel({ requestType: 'edd', nyplSource: 'recap-pul' });

      return expect(result).to.eql({ requestingInstitution: 'NYPL', requestType: 'EDD', itemOwningInstitution: 'PUL' });
    });

    it('should return an object with properties (requestingInstitution, requestType and itemOwningInstitution) if requestType is hold and nyplSource is recap-cul', () => {
      const result = generateSCSBModel({ requestType: 'hold', nyplSource: 'recap-cul' });

      return expect(result).to.eql({ requestingInstitution: 'NYPL', requestType: 'RETRIEVAL', itemOwningInstitution: 'CUL' });
    });

    it('should return an object with properties (requestingInstitution, requestType and itemOwningInstitution) if requestType is hold and nyplSource is sierra-nypl', () => {
      const result = generateSCSBModel({ requestType: 'hold', nyplSource: 'sierra-nypl' });

      return expect(result).to.eql({ requestingInstitution: 'NYPL', requestType: 'RETRIEVAL', itemOwningInstitution: 'NYPL' });
    });

    it('should return an object without a patronBarcode property if the barCodes array supplied is empty', () => {
      const result = generateSCSBModel({ requestType: 'hold', nyplSource: 'sierra-nypl', patronInfo: { barCodes: [] } });

      return expect(result).to.eql({ requestingInstitution: 'NYPL', requestType: 'RETRIEVAL', itemOwningInstitution: 'NYPL' });
    });

    it('should return an object with properties (requestingInstitution, requestType and itemOwningInstitution and patronBarcode) if requestType is hold and nyplSource is sierra-nypl and the barCodes array is defined', () => {
      const result = generateSCSBModel({ requestType: 'hold', nyplSource: 'sierra-nypl', patronInfo: { barCodes: ['1234'] } });

      return expect(result).to.eql({ requestingInstitution: 'NYPL', requestType: 'RETRIEVAL', itemOwningInstitution: 'NYPL', patronBarcode: '1234' });
    });
  });
});
