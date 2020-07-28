const chai = require('chai')
const expect = chai.expect
const stub = require('sinon').stub
const axios = require('axios');
const MockAdapter = require('axios-mock-adapter');

const HoldRequestDispatcher = require('../../src/helpers/HoldRequestDispatcher')
const OnSiteHoldRequestHelper = require('../../src/helpers/OnSiteHoldRequestHelper')
const SCSBApiHelper = require('../../src/helpers/SCSBApiHelper')

const onSiteEddRequest = require('../fixtures/onSiteEddRequest')
const onSiteRequest = require('../fixtures/onSiteRequest')
const recapNyplItemRequest = require('../fixtures/nyplRecapRequest')
const partnerItemRequest = require('../fixtures/nyplRecapRequest')

const mixedRecords = [ onSiteEddRequest, recapNyplItemRequest, partnerItemRequest ]

describe('HoldRequestConsumer Lambda: HoldRequestDispatcher', () => {
  describe('sortRecords', () => {
    it('should sort records according to nyplSource and holding location', () => {
      const sortedRecords = HoldRequestDispatcher.sortRecords(mixedRecords)
      expect(sortedRecords.scsb.length).to.equal(2)
      expect(sortedRecords.onSite.length).to.equal(1)
    })
  })
  describe('dispatchRecords', () => {
    let postOnSiteHoldRequestStub
    let postScsbHoldRequestStub
    before(() => {
      postOnSiteHoldRequestStub = stub(OnSiteHoldRequestHelper, 'handlePostingRecords').callsFake(records => Promise.resolve(records))
      postScsbHoldRequestStub = stub(SCSBApiHelper, 'handlePostingRecords').callsFake(records => Promise.resolve(records))
    })
    after(() => {
      postOnSiteHoldRequestStub.restore()
      postScsbHoldRequestStub.restore()
    })

    beforeEach(() => {
      postOnSiteHoldRequestStub.reset()
      postScsbHoldRequestStub.reset()
    })

    describe('mixed requests', () => {
      it('should call SCSBApiHelper and OnSiteHoldRequestHelper `handlePostingRecords` functions once each', () => {
        HoldRequestDispatcher.dispatchRecords(mixedRecords)
        expect(postOnSiteHoldRequestStub.calledOnce).to.be.true
        expect(postScsbHoldRequestStub.calledOnce).to.be.true
      })
    })

    describe('only on-site hold requests', () => {
      it('should only call OnSiteHoldRequestHelper `handlePostingRecords` function', () => {
        HoldRequestDispatcher.dispatchRecords([ onSiteEddRequest ])
        expect(postOnSiteHoldRequestStub.calledOnce).to.be.true
        expect(postScsbHoldRequestStub.notCalled).to.be.true
      })
    })

    describe('only scsb hold requests', () => {
      it('should only call SCSBApiHelper `handlePostingRecords` function', () => {
        HoldRequestDispatcher.dispatchRecords([ recapNyplItemRequest ])
        expect(postOnSiteHoldRequestStub.notCalled).to.be.true
        expect(postScsbHoldRequestStub.calledOnce).to.be.true
      })
    })
  })
})
