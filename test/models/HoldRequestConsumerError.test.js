/* eslint-disable semi */
const chai = require('chai');
const expect = chai.expect;
const HoldRequestConsumerError = require('../../src/models/HoldRequestConsumerError.js');

describe('HoldRequestConsumer Lambda: HoldRequestConsumerError(object)', () => {
  it('should have default properties when no params are passed', () => {
    const result = HoldRequestConsumerError();
    expect(result).to.have.property('name', 'HoldRequestConsumerError');
    expect(result).to.have.property('errorType', 'hold-request-consumer-error');
    expect(result).to.have.property('errorMessage', 'An error occurred');
    expect(result).to.have.property('isHoldRequestConsumerError', true);
  });

  it('should work with NEW constructor the same way with or without params', () => {
    const result = new HoldRequestConsumerError();
    expect(result).to.have.property('name', 'HoldRequestConsumerError');
    expect(result).to.have.property('errorType', 'hold-request-consumer-error');
    expect(result).to.have.property('errorMessage', 'An error occurred');
    expect(result).to.have.property('isHoldRequestConsumerError', true);
  });

  it('should return the passed errorType string param', () => {
    expect(
      HoldRequestConsumerError({ type: 'scsb-api-error'})
    ).to.have.property('errorType', 'scsb-api-error');
  });

  it('should return the passed errorMessage string param', () => {
    expect(
      HoldRequestConsumerError({ message: 'test message'})
    ).to.have.property('errorMessage', 'test message');
  });

  it('should return the passed holdRequestId param', () => {
    expect(
      HoldRequestConsumerError({ holdRequestId: 123 })
    ).to.have.property('holdRequestId', 123);
  });

  it('should return the passed function param', () => {
    expect(
      HoldRequestConsumerError({ function: 'scsbPostItem' })
    ).to.have.property('function', 'scsbPostItem');
  });

  it('should return the passed status param', () => {
    expect(
      HoldRequestConsumerError({ status: 401 })
    ).to.have.property('errorStatus', 401);
  });

  it('should return the passed error object param', () => {
    expect(
      HoldRequestConsumerError({ error: { test: 'one' } })
    ).to.have.deep.property('errorDetails', { test: 'one' })
  });
});
