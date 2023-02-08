const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
const axios = require('axios');
const MockAdapter = require('axios-mock-adapter');

const OnSiteHoldRequestHelper = require('../../src/helpers/OnSiteHoldRequestHelper')
const ResultStreamHelper = require('../../src/helpers/ResultStreamHelper')

const onSiteEddRequest = require('../fixtures/onSiteEddRequest')
const onSiteRequest = require('../fixtures/onSiteRequest')

const mock = new MockAdapter(axios);

describe('HoldRequestConsumer Lambda: OnSiteHoldRequestHelper', () => {
  let postRecordToStreamStub;
  const apiBaseUrl = 'www.example.com/';
  before(() => {
    postRecordToStreamStub = sinon.stub(ResultStreamHelper, 'postRecordToStream').callsFake(function () {
      return Promise.resolve({ success: true })
    })
  })

  after(() => {
    postRecordToStreamStub.restore()
  })

  describe('handlePostingRecords() function', () => {
    const handlePostingRecords = OnSiteHoldRequestHelper.handlePostingRecords;
    describe('successful post to OnSiteHoldRequestService', () => {
      let result;
      before(() => {
        mock.onPost(`${apiBaseUrl}on-site-hold-requests`).reply(201);
        result = handlePostingRecords([onSiteEddRequest], { apiBaseUrl })
      })

      it('should post to HoldRequestResultStream with no `errorType`', () => {
        postRecordToStreamStub.args[0][0].errorType
        expect(postRecordToStreamStub.args[0][0].errorType).to.be.null;
        return result.should.be.fulfilled;
      })
    })

    describe('unsuccessful post to OnSiteHoldRequestService', () => {
      let result;
      before(() => {
        mock.onPost(`${apiBaseUrl}on-site-hold-requests`).reply(404);
        result = handlePostingRecords([onSiteEddRequest], { apiBaseUrl })
      })

      it('should post to HoldRequestResultStream with `errorType`', () => {
        expect(postRecordToStreamStub.args[1][0].errorType).to.be.a('string');
        return result.should.be.fulfilled;
      })
    })
  });

  describe('generateModel(object) function', () => {
    const generateOnSiteHoldRequestModel = OnSiteHoldRequestHelper.generateModel;
    it('should handle the expected collection of fields and ignore others', () => {
      const mockRecord = {
        patron: 'Cthulhu',
        nyplSource: 'recap-R\'lyeh',
        pickupLocation: 'SASB',
        record: 'Piano for 8 hands',
        neededBy: 'yesterday',
        numberOfCopies: '8',
        docDeliveryData: 'what is this field?',
        requestType: 'hold',
        additionalNotes: 'Ph\'nglui mglw\'nafh Cthulhu R\'lyeh wgah\'nagl fhtagn',
      }
      const generatedModel = generateOnSiteHoldRequestModel(mockRecord)
      const keys = Object.keys(generatedModel)
      expect(keys.length).to.equal(8)
      expect(keys).to.include('patron')
      expect(keys).to.include('nyplSource')
      expect(keys).to.include('record')
      expect(keys).to.include('pickupLocation')
      expect(keys).to.include('neededBy')
      expect(keys).to.include('numberOfCopies')
      expect(keys).to.include('docDeliveryData')
      expect(keys).to.include('requestType')
    })
  });
});
