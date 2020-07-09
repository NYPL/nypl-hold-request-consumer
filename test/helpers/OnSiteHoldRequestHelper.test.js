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
  });
});
