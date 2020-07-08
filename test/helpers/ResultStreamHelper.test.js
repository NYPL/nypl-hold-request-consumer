/* eslint-disable semi */
const chai = require('chai');
const sinon = require('sinon');
const chaiAsPromised = require('chai-as-promised');
const NyplStreamsClient = require('@nypl/nypl-streams-client');
const ResultStreamHelper = require('../../src/helpers/ResultStreamHelper');
const expect = chai.expect;
chai.should();
chai.use(chaiAsPromised);

describe('HoldRequestConsumer Lambda: ResultStreamHelper', () => {
  describe('postRecordToStream(object, string, string) function', () => {

    const postRecordToStream = ResultStreamHelper.postRecordToStream;

    it('should reject with a HoldRequestConsumerError if no arguments are passed', () => {
      const result = postRecordToStream();
      return result.should.be.rejected.and.eventually.have.property('errorType', 'undefined-function-parameter');
    });

    it('should reject with a HoldRequestConsumerError if no holdRequestId object parameter is defined', () => {
      const result = postRecordToStream({}, 'streamName', 'schemaName', 'apiBaseUrl');
      return result.should.be.rejected.and.eventually.have.property(
        'errorMessage',
        'the holdRequestId object property from the object parameter is not defined, unable to post record to stream'
      );
    });

    it('should reject with a HoldRequestConsumerError if the streamName parameter is undefined', () => {
      const result = postRecordToStream({ holdRequestId: 123 }, undefined, 'schemaName', 'apiBaseUrl');
      return result.should.be.rejected.and.eventually.have.property(
        'errorMessage',
        'the streamName parameter used to post results is undefined'
      );
    });

    it('should reject with a HoldRequestConsumerError if the streamName parameter is null', () => {
      const result = postRecordToStream({ holdRequestId: 123 }, null, 'schemaName', 'apiBaseUrl');
      return result.should.be.rejected.and.eventually.have.property(
        'errorMessage',
        'the streamName parameter used to post results is undefined'
      );
    });

    it('should reject with a HoldRequestConsumerError if the streamName parameter is an empty string', () => {
      const result = postRecordToStream({ holdRequestId: 123 }, '', 'schemaName', 'apiBaseUrl');
      return result.should.be.rejected.and.eventually.have.property(
        'errorMessage',
        'the streamName parameter used to post results is undefined'
      );
    });

    it('should reject with a HoldRequestConsumerError if the schemaName parameter is undefined', () => {
      const result = postRecordToStream({ holdRequestId: 123 }, 'streamName', undefined, 'apiBaseUrl');
      return result.should.be.rejected.and.eventually.have.property(
        'errorMessage',
        'the schemaName parameter used to post results is undefined'
      );
    });

    it('should reject with a HoldRequestConsumerError if the schemaName parameter is null', () => {
      const result = postRecordToStream({ holdRequestId: 123 }, 'streamName', null, 'apiBaseUrl');
      return result.should.be.rejected.and.eventually.have.property(
        'errorMessage',
        'the schemaName parameter used to post results is undefined'
      );
    });

    it('should reject with a HoldRequestConsumerError if the schemaName parameter is an empty string', () => {
      const result = postRecordToStream({ holdRequestId: '123' }, 'streamName', '', 'apiBaseUrl');
      return result.should.be.rejected.and.eventually.have.property(
        'errorMessage',
        'the schemaName parameter used to post results is undefined'
      );
    });

    it('should reject with a HoldRequestConsumerError if the nyplDataApiBase parameter is undefined', () => {
      const result = postRecordToStream({ holdRequestId: 123 }, 'streamName', 'schemaName', undefined);
      return result.should.be.rejected.and.eventually.have.property(
        'errorMessage',
        'the nyplDataApiBase parameter used to post results is undefined'
      );
    });

    it('should reject with a HoldRequestConsumerError if the nyplDataApiBase parameter is null', () => {
      const result = postRecordToStream({ holdRequestId: 123 }, 'streamName', 'schemaName', null);
      return result.should.be.rejected.and.eventually.have.property(
        'errorMessage',
        'the nyplDataApiBase parameter used to post results is undefined'
      );
    });

    it('should reject with a HoldRequestConsumerError if the nyplDataApiBase parameter is an empty string', () => {
      const result = postRecordToStream({ holdRequestId: 123 }, 'streamName', 'schemaName', '');
      return result.should.be.rejected.and.eventually.have.property(
        'errorMessage',
        'the nyplDataApiBase parameter used to post results is undefined'
      );
    });

    it('should call the NyplStreamsClient.write() function with a valid HoldRequest object', () => {
      const NyplStreamsClientStubInstance = sinon.stub(NyplStreamsClient.prototype, 'write').returns('success');
      const result = ResultStreamHelper.postRecordToStream({ holdRequestId: 123 }, 'HoldRequestResult', 'HoldRequestResult', 'https://api.test.org/v1/');

      NyplStreamsClientStubInstance.restore();
      sinon.assert.calledOnce(NyplStreamsClientStubInstance);
    });

    it('should call the NyplStreamsClient.write() function with a valid HoldRequest object with `errorType` equal to null', () => {
      const NyplStreamsClientStubInstance = sinon.stub(NyplStreamsClient.prototype, 'write').returns('success');
      const result = ResultStreamHelper.postRecordToStream({ holdRequestId: 123, errorType: null }, 'HoldRequestResult', 'HoldRequestResult', 'https://api.test.org/v1/');

      NyplStreamsClientStubInstance.restore();
      sinon.assert.calledOnce(NyplStreamsClientStubInstance);
      expect(NyplStreamsClientStubInstance.args[0][1].success).to.be.true;
    });

    it('should call the NyplStreamsClient.write() function with an invalid HoldRequest object', () => {
      const NyplStreamsClientStubInstance = sinon.stub(NyplStreamsClient.prototype, 'write').returns('error');
      const result = ResultStreamHelper.postRecordToStream(
        {
          holdRequestId: 123,
          errorType: 'scsb-api-error',
          errorMessage: 'SCSB API ERROR'
        },
        'HoldRequestResult',
        'HoldRequestResult',
        'https://api.test.org/v1/'
      );

      NyplStreamsClientStubInstance.restore();
      sinon.assert.calledOnce(NyplStreamsClientStubInstance);
    });
  });
});
