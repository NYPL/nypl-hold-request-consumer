/* eslint-disable semi */
function HoldRequestConsumerError (settings, implementationContext) {
  if (!(this instanceof HoldRequestConsumerError)) {
    return new HoldRequestConsumerError(settings, implementationContext);
  }
  // Ensure that settings exists to prevent reference errors
  settings = settings || {};
  // Override the default name property (Error)
  this.name = 'HoldRequestConsumerError';
  this.type = settings.type || 'hold-request-consumer-error';
  this.message = settings.message || 'An error occurred';

  // Optional settings
  if (settings.status) {
    this.status = settings.status;
  }

  if (settings.function) {
    this.function = settings.function;
  }

  if (settings.error) {
    this.error = settings.error;
  }
  // This is just a flag that will indicate if the error is a custom HoldRequestConsumerError. If this
  // is not an HoldRequestConsumerError, this property will be undefined, which is a Falsey.
  this.isHoldRequestConsumerError = true;

  Error.captureStackTrace(this, (implementationContext || HoldRequestConsumerError));
}

module.exports = HoldRequestConsumerError;
