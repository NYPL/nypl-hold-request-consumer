/* eslint-disable semi */
const winston = require('winston');
// Supress error handling
winston.emitErrs = true;
// Set default NYPL agreed upon log levels
const nyplLogLevels = {
  levels: {
    emergency: 0,
    alert: 1,
    critical: 2,
    error: 3,
    warning: 4,
    notice: 5,
    info: 6,
    debug: 7
  }
};

const logger = new winston.Logger({
  levels: nyplLogLevels.levels,
  transports: [
    new (winston.transports.Console)({
      timestamp: () => {
        return new Date().toISOString();
      },
      formatter: (options) => {
        const result = {
          timestamp: options.timestamp(),
          level: options.level.toUpperCase()
        };

        if (process.pid) {
          result.pid = process.pid.toString();
        }

        if (options.message) {
          result.message = options.message;
        }

        if (options.meta && Object.keys(options.meta).length) {
          if (options.meta.holdRequestId) {
            result.holdRequestId = options.meta.holdRequestId;
            delete options.meta.holdRequestId;
          }

          if (options.meta && Object.keys(options.meta).length) {
            result.meta = JSON.stringify(options.meta);
          }
        }

        return JSON.stringify(result);
      }
    })
  ],
  exitOnError: false
});

module.exports = logger;
