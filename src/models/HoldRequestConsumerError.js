function HoldRequestConsumerError(settings, implementationContext) {
  if (!(this instanceof HoldRequestConsumerError)) {
    return new HoldRequestConsumerError(settings, implementationContext);
  }
  // Ensure that settings exists to prevent refernce errors.
  settings = settings || {};
  // Override the default name property (Error). This is basically zero value-add.
  this.name = 'HoldRequestConsumerError';
  this.type = settings.type || 'generic-hold-request-consumer-error';
  this.message = settings.message || 'An error occurred';
  this.status = settings.errorCode || 500;

  if (settings.details) {
    this.details = settings.details;
  }
  // This is just a flag that will indicate if the error is a custom HoldRequestConsumerError. If this
  // is not an HoldRequestConsumerError, this property will be undefined, which is a Falsey.
  this.isHoldRequestConsumerError = true;

  Error.captureStackTrace(this, (implementationContext || HoldRequestConsumerError));
}

module.exports = HoldRequestConsumerError;
