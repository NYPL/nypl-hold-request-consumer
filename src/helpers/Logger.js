const winston = require('winston');
// Supress error handling
winston.emitErrs = true;

const logger = new winston.Logger({
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

        if (options.message) {
          result.message = options.message;
        }

        if (process.pid) {
          result.pid = process.pid.toString();
        }

        if (options.meta && Object.keys(options.meta).length) {
          if (options.meta.jobId) {
            result.jobId = options.meta.jobId;
            delete options.meta.jobId;
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
