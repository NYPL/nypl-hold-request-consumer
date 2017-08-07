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
      expect(kinesisHandlerStub).to.be.called;
    });
  });

  describe('Kinesis Handler: exports.kinesisHandler()', () => {
    it('should return a HoldRequestConsumerError if no config object is defined', () => {
      const result = kinesisHandlerFunc(event.Records, {});
      expect(result).to.have.property('errorType', 'missing-kinesis-function-parameter');
      expect(result).to.have.property('errorMessage', 'missing schemaName configuration parameter');
    });

    it('should return a HoldRequestConsumerError if no schemaName configuration parameter is defined', () => {
      const result = kinesisHandlerFunc(
        event.Records,
        {}
      );

      expect(result).to.have.property('errorType', 'missing-kinesis-function-parameter');
      expect(result).to.have.property('errorMessage', 'missing schemaName configuration parameter');
    });

    it('should return a HoldRequestConsumerError if the schemaName configuration parameter is an empty string', () => {
      const result = kinesisHandlerFunc(
        event.Records,
        {
          schemaName: '',
        }
      );

      expect(result).to.have.property('errorType', 'missing-kinesis-function-parameter');
      expect(result).to.have.property('errorMessage', 'missing schemaName configuration parameter');
    });


    it('should return a HoldRequestConsumerError if no resultStreamName configuration parameter is defined', () => {
      const result = kinesisHandlerFunc(
        event.Records,
        {
          schemaName: 'schemaName'
        }
      );

      expect(result).to.have.property('errorType', 'missing-kinesis-function-parameter');
      expect(result).to.have.property('errorMessage', 'missing resultStreamName configuration parameter');
    });

    it('should return a HoldRequestConsumerError if the resultStreamName configuration parameter is an empty string', () => {
      const result = kinesisHandlerFunc(
        event.Records,
        {
          schemaName: 'schemaName',
          resultStreamName: ''
        }
      );

      expect(result).to.have.property('errorType', 'missing-kinesis-function-parameter');
      expect(result).to.have.property('errorMessage', 'missing resultStreamName configuration parameter');
    });

    it('should return a HoldRequestConsumerError if no nyplDataApiBaseUrl configuration parameter is defined', () => {
      const result = kinesisHandlerFunc(
        event.Records,
        {
          schemaName: 'schemaName',
          resultStreamName: 'streamName'
        }
      );

      expect(result).to.have.property('errorType', 'missing-kinesis-function-parameter');
      expect(result).to.have.property('errorMessage', 'missing nyplDataApiBaseUrl configuration parameter');
    });

    it('should return a HoldRequestConsumerError if the nyplDataApiBaseUrl configuration parameter is an empty string', () => {
      const result = kinesisHandlerFunc(
        event.Records,
        {
          schemaName: 'schemaName',
          resultStreamName: 'streamName',
          nyplDataApiBaseUrl: ''
        }
      );

      expect(result).to.have.property('errorType', 'missing-kinesis-function-parameter');
      expect(result).to.have.property('errorMessage', 'missing nyplDataApiBaseUrl configuration parameter');
    });

    it('should return a HoldRequestConsumerError if no scsbApiBaseUrl configuration parameter is defined', () => {
      const result = kinesisHandlerFunc(
        event.Records,
        {
          schemaName: 'schemaName',
          resultStreamName: 'streamName',
          nyplDataApiBaseUrl: 'http://test.test.org'
        }
      );

      expect(result).to.have.property('errorType', 'missing-kinesis-function-parameter');
      expect(result).to.have.property('errorMessage', 'missing scsbApiBaseUrl configuration parameter');
    });

    it('should return a HoldRequestConsumerError if the scsbApiBaseUrl configuration parameter is an empty string', () => {
      const result = kinesisHandlerFunc(
        event.Records,
        {
          schemaName: 'schemaName',
          resultStreamName: 'streamName',
          nyplDataApiBaseUrl: 'http://test.test.org',
          scsbApiBaseUrl: ''
        }
      );

      expect(result).to.have.property('errorType', 'missing-kinesis-function-parameter');
      expect(result).to.have.property('errorMessage', 'missing scsbApiBaseUrl configuration parameter');
    });

    it('should return a HoldRequestConsumerError if no scsbApiKey configuration parameter is defined', () => {
      const result = kinesisHandlerFunc(
        event.Records,
        {
          schemaName: 'schemaName',
          resultStreamName: 'streamName',
          nyplDataApiBaseUrl: 'http://test.test.org',
          scsbApiBaseUrl: 'http://test.scsb.api.org'
        }
      );

      expect(result).to.have.property('errorType', 'missing-kinesis-function-parameter');
      expect(result).to.have.property('errorMessage', 'missing scsbApiKey configuration parameter');
    });

    it('should return a HoldRequestConsumerError if the scsbApiKey configuration parameter is an empty string', () => {
      const result = kinesisHandlerFunc(
        event.Records,
        {
          schemaName: 'schemaName',
          resultStreamName: 'streamName',
          nyplDataApiBaseUrl: 'http://test.test.org',
          scsbApiBaseUrl: 'http://test.scsb.api.org',
          scsbApiKey: ''
        }
      );

      expect(result).to.have.property('errorType', 'missing-kinesis-function-parameter');
      expect(result).to.have.property('errorMessage', 'missing scsbApiKey configuration parameter');
    });

    it('should return a HoldRequestConsumerError if no oAuthProviderUrl configuration parameter is defined', () => {
      const result = kinesisHandlerFunc(
        event.Records,
        {
          schemaName: 'schemaName',
          resultStreamName: 'streamName',
          nyplDataApiBaseUrl: 'http://test.test.org',
          scsbApiBaseUrl: 'http://test.scsb.api.org',
          scsbApiKey: 'fakekey'
        }
      );

      expect(result).to.have.property('errorType', 'missing-kinesis-function-parameter');
      expect(result).to.have.property('errorMessage', 'missing oAuthProviderUrl configuration parameter');
    });

    it('should return a HoldRequestConsumerError if the oAuthProviderUrl configuration parameter is an empty string', () => {
      const result = kinesisHandlerFunc(
        event.Records,
        {
          schemaName: 'schemaName',
          resultStreamName: 'streamName',
          nyplDataApiBaseUrl: 'http://test.test.org',
          scsbApiBaseUrl: 'http://test.scsb.api.org',
          scsbApiKey: 'fakekey',
          oAuthProviderUrl: ''
        }
      );

      expect(result).to.have.property('errorType', 'missing-kinesis-function-parameter');
      expect(result).to.have.property('errorMessage', 'missing oAuthProviderUrl configuration parameter');
    });

    it('should return a HoldRequestConsumerError if no oAuthClientId configuration parameter is defined', () => {
      const result = kinesisHandlerFunc(
        event.Records,
        {
          schemaName: 'schemaName',
          resultStreamName: 'streamName',
          nyplDataApiBaseUrl: 'http://test.test.org',
          scsbApiBaseUrl: 'http://test.scsb.api.org',
          scsbApiKey: 'fakekey',
          oAuthProviderUrl: 'http://oauth.fake.url'
        }
      );

      expect(result).to.have.property('errorType', 'missing-kinesis-function-parameter');
      expect(result).to.have.property('errorMessage', 'missing oAuthClientId configuration parameter');
    });

    it('should return a HoldRequestConsumerError if the oAuthClientId configuration parameter is an empty string', () => {
      const result = kinesisHandlerFunc(
        event.Records,
        {
          schemaName: 'schemaName',
          resultStreamName: 'streamName',
          nyplDataApiBaseUrl: 'http://test.test.org',
          scsbApiBaseUrl: 'http://test.scsb.api.org',
          scsbApiKey: 'fakekey',
          oAuthProviderUrl: 'http://oauth.fake.url',
          oAuthClientId: ''
        }
      );

      expect(result).to.have.property('errorType', 'missing-kinesis-function-parameter');
      expect(result).to.have.property('errorMessage', 'missing oAuthClientId configuration parameter');
    });

    it('should return a HoldRequestConsumerError if no oAuthClientSecret configuration parameter is defined', () => {
      const result = kinesisHandlerFunc(
        event.Records,
        {
          schemaName: 'schemaName',
          resultStreamName: 'streamName',
          nyplDataApiBaseUrl: 'http://test.test.org',
          scsbApiBaseUrl: 'http://test.scsb.api.org',
          scsbApiKey: 'fakekey',
          oAuthProviderUrl: 'http://oauth.fake.url',
          oAuthClientId: 'fakeid'
        }
      );

      expect(result).to.have.property('errorType', 'missing-kinesis-function-parameter');
      expect(result).to.have.property('errorMessage', 'missing oAuthClientSecret configuration parameter');
    });

    it('should return a HoldRequestConsumerError if the oAuthClientSecret configuration parameter is an empty string', () => {
      const result = kinesisHandlerFunc(
        event.Records,
        {
          schemaName: 'schemaName',
          resultStreamName: 'streamName',
          nyplDataApiBaseUrl: 'http://test.test.org',
          scsbApiBaseUrl: 'http://test.scsb.api.org',
          scsbApiKey: 'fakekey',
          oAuthProviderUrl: 'http://oauth.fake.url',
          oAuthClientId: 'fakeid',
          oAuthClientSecret: ''
        }
      );

      expect(result).to.have.property('errorType', 'missing-kinesis-function-parameter');
      expect(result).to.have.property('errorMessage', 'missing oAuthClientSecret configuration parameter');
    });

    // it('should return null if the apiUri param is an empty string', () => {
    //   const result = kinesisHandlerFunc(event.Records, { schema: schemaName, apiUri: '' }, null);
    //   expect(result).to.equal(null);
    // });
    //
    // it('should return a promise if the proper event.Records, schema and apiUri are defined', () => {
    //   const result = kinesisHandlerFunc(event.Records, { schema: schemaName, apiUri }, null);
    //   expect(result).to.be.a('promise');
    // });
  });
});
