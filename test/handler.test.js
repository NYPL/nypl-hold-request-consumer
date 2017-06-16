/* eslint-disable semi */
const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const expect = chai.expect;
const HoldRequestConsumer = require('../index.js');
const event = require('../sample/sample_event.json');
chai.use(sinonChai);

const kinesisHandlerFunc = HoldRequestConsumer.kinesisHandler;
const schemaName = 'HoldRequestService';
const apiUri = 'https://api.nypltech.org/api/v0.1/';

describe('HoldRequestConsumer Lambda: Handle Kinesis Stream Input', () => {
  let kinesisHandlerStub;

  describe('Main Handler: exports.handler()', () => {
    beforeEach(() => {
      kinesisHandlerStub = sinon.stub(HoldRequestConsumer, 'kinesisHandler');
    });

    afterEach(() => {
      kinesisHandlerStub.restore();
    });

    it('should call the kinesisHandler function', () => {
      HoldRequestConsumer.handler(event);
      expect(kinesisHandlerStub).to.have.been.called;
      expect(kinesisHandlerStub).to.be.calledWith(event.Records);
    });
  });

  describe('Kinesis Handler: exports.kinesisHandler()', () => {
    it('should return null if no config object is defined', () => {
      const result = kinesisHandlerFunc(event.Records, {}, null);
      expect(result).to.equal(null);
    });

    it('should return null if no schema param is defined', () => {
      const result = kinesisHandlerFunc(event.Records, { apiUri: 'test' }, null);
      const result2 = kinesisHandlerFunc(event.Records, { schema: undefined, apiUri: 'test' }, null);
      expect(result).to.equal(null);
      expect(result2).to.equal(null);
    });

    it('should return null if the schema param is an empty string', () => {
      const result = kinesisHandlerFunc(event.Records, { schema: '', apiUri: 'test' }, null);
      expect(result).to.equal(null);
    });

    it('should return null if no apiUri param is defined', () => {
      const result = kinesisHandlerFunc(event.Records, { schema: schemaName }, null);
      const result2 = kinesisHandlerFunc(event.Records, { schema: schemaName, apiUri: undefined }, null);
      expect(result).to.equal(null);
      expect(result2).to.equal(null);
    });

    it('should return null if the apiUri param is an empty string', () => {
      const result = kinesisHandlerFunc(event.Records, { schema: schemaName, apiUri: '' }, null);
      expect(result).to.equal(null);
    });

    it('should return a promise if the proper event.Records, schema and apiUri are defined', () => {
      const result = kinesisHandlerFunc(event.Records, { schema: schemaName, apiUri }, null);
      expect(result).to.be.a('promise');
    });
  });
});
