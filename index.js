/* eslint-disable semi */
const NyplStreamsClient = require('@nypl/nypl-streams-client');
const HoldRequestConsumerModel = require('./src/models/HoldRequestConsumerModel');
const HoldRequestConsumerError = require('./src/models/HoldRequestConsumerError');
const ApiServiceHelper = require('./src/helpers/ApiServiceHelper');
const SCSBApiHelper = require('./src/helpers/SCSBApiHelper');
const logger = require('./src/helpers/Logger');
const CACHE = require('./src/globals/index');

exports.kinesisHandler = (records, opts = {}, context, callback) => {
  const functionName = 'kinesisHandler';

  try {
    if (!opts.schemaName || opts.schemaName === '') {
      throw HoldRequestConsumerError({
        message: 'missing schemaName configuration parameter',
        type: 'missing-kinesis-function-parameter',
        function: functionName
      });
    }

    if (!opts.resultStreamName || opts.resultStreamName === '') {
      throw HoldRequestConsumerError({
        message: 'missing resultStreamName configuration parameter',
        type: 'missing-kinesis-function-parameter',
        function: functionName
      });
    }

    if (!opts.nyplDataApiBaseUrl || opts.nyplDataApiBaseUrl === '') {
      throw HoldRequestConsumerError({
        message: 'missing nyplDataApiBaseUrl configuration parameter',
        type: 'missing-kinesis-function-parameter',
        function: functionName
      });
    }

    if (!opts.scsbApiBaseUrl || opts.scsbApiBaseUrl === '') {
      throw HoldRequestConsumerError({
        message: 'missing scsbApiBaseUrl configuration parameter',
        type: 'missing-kinesis-function-parameter',
        function: functionName
      });
    }

    if (!opts.scsbApiKey || opts.scsbApiKey === '') {
      throw HoldRequestConsumerError({
        message: 'missing scsbApiKey configuration parameter',
        type: 'missing-kinesis-function-parameter',
        function: functionName
      });
    }

    if (!opts.oAuthProviderUrl || opts.oAuthProviderUrl === '') {
      throw HoldRequestConsumerError({
        message: 'missing oAuthProviderUrl configuration parameter',
        type: 'missing-kinesis-function-parameter',
        function: functionName
      });
    }

    if (!opts.oAuthClientId || opts.oAuthClientId === '') {
      throw HoldRequestConsumerError({
        message: 'missing oAuthClientId configuration parameter',
        type: 'missing-kinesis-function-parameter',
        function: functionName
      });
    }

    if (!opts.oAuthClientSecret || opts.oAuthClientSecret === '') {
      throw HoldRequestConsumerError({
        message: 'missing oAuthClientSecret configuration parameter',
        type: 'missing-kinesis-function-parameter',
        function: functionName
      });
    }

    if (!opts.oAuthProviderScope || opts.oAuthProviderScope === '') {
      throw HoldRequestConsumerError({
        message: 'missing oAuthProviderScope configuration parameter',
        type: 'missing-kinesis-function-parameter',
        function: functionName
      });
    }

    // Store configuration and ENV variables to global CACHE object
    CACHE.setSchemaName(opts.schemaName);
    CACHE.setResultStreamName(opts.resultStreamName);
    CACHE.setNyplDataApiBaseUrl(opts.nyplDataApiBaseUrl);
    CACHE.setSCSBApiBaseUrl(opts.scsbApiBaseUrl);
    CACHE.setSCSBApiKey(opts.scsbApiKey);

    const hrcModel = new HoldRequestConsumerModel();
    const streamsClient = new NyplStreamsClient({ nyplDataApiClientBase: CACHE.getNyplDataApiBaseUrl() });
    const apiHelper = new ApiServiceHelper(
      opts.oAuthProviderUrl,
      opts.oAuthClientId,
      opts.oAuthClientSecret,
      opts.oAuthProviderScope
    );

    return Promise.all([
      apiHelper.setTokenFromOAuthService(),
      streamsClient.decodeData(CACHE.getSchemaName(), records.map(i => i.kinesis.data))
    ]).then(result => {
      if (result[0] === 'access-token-exists-in-cache') {
        logger.info('reusing access_token already defined in CACHE, no API call to OAuth Service was executed');
      }

      return hrcModel.filterProcessedRecords(result[1]);
    })
    .then(filteredRecordsToProcess => {
      logger.info('storing decoded/filtered kinesis records to HoldRequestConsumerModel');
      hrcModel.setRecords(filteredRecordsToProcess);

      return apiHelper.handleHttpAsyncRequests(
        hrcModel.getRecords(),
        'item-service',
        CACHE.getNyplDataApiBaseUrl(),
        CACHE.getAccessToken()
      );
    })
    .then(recordsWithItemData => {
      logger.info('storing updated records that may contain Item data to the HoldRequestConsumerModel; if a record was posted to the HoldRequestResult stream, it was filtered from the original records');
      hrcModel.setRecords(recordsWithItemData);

      return apiHelper.handleHttpAsyncRequests(
        hrcModel.getRecords(),
        'patron-barcode-service',
        CACHE.getNyplDataApiBaseUrl(),
        CACHE.getAccessToken()
      );
    })
    .then(recordsWithPatronData => {
      logger.info('storing updated records that may contain Patron data to the HoldRequestConsumerModel; if a record was posted to the HoldRequestResult stream, it was filtered from the original records');
      hrcModel.setRecords(recordsWithPatronData);

      return SCSBApiHelper.handlePostingRecordsToSCSBApi(
        hrcModel.getRecords(),
        CACHE.getSCSBApiBaseUrl(),
        CACHE.getSCSBApiKey()
      );
    })
    .then(resultsOfRecordswithScsbResponse => {
      const successMsg = 'successfully completed Lambda execution without any fatal or recoverable errors';

      logger.info(successMsg);
      hrcModel.setRecords(resultsOfRecordswithScsbResponse);

      return callback(null, successMsg);
    })
    .catch(error => {
      console.log(error);
      // Non-recoverable Error: Avro Schema validation failed, do not restart Lambda
      if (error.name === 'AvroValidationError') {
        logger.error(
          'a fatal/non-recoverable AvroValidationError occured which prohibits decoding the kinesis stream; Hold Request Consumer Lambda will NOT restart',
          { debugInfo: error.message }
        );
      } else if (error.name === 'HoldRequestConsumerError') {
        if (error.errorType === 'empty-filtered-records') {
          logger.notice(
            'the filtered hold request records array was empty which signifies all records contained the proccessed flag as TRUE; the Lambda will not continue to proccess an empty array of records',
            { debugInfo: error }
          );

          return false;
        }

        // Recoverable Error: The HoldRequestResult Stream returned an error, will attempt to restart handler.
        if (error.errorType === 'hold-request-result-stream-error') {
          logger.error(
            'restarting the HoldRequestConsumer Lambda; unable to POST data to the HoldRequestResult stream',
            { debugInfo: error }
          );

          return callback(error);
        }

        // Recoverable Error: The OAuth Service might be down, will attempt to restart handler.
        if (error.errorType === 'oauth-service-error' && error.errorStatus >= 500) {
          logger.error(
            'restarting the HoldRequestConsumer Lambda; the OAuth service returned a 5xx status code',
            { debugInfo: error }
          );

          return callback(error);
        }

        // Recoverable Error: The Item Service might be down, will attempt to restart handler.
        if (error.errorType === 'item-service-error' && error.errorStatus >= 500) {
          logger.error(
            'restarting the HoldRequestConsumer Lambda; the Item Service returned a 5xx status code',
            { debugInfo: error }
          );

          return callback(error);
        }

        // Recoverable Error: The Patron Service might be down, will attempt to restart handler.
        if (error.errorType === 'patron-service-error' && error.errorStatus >= 500) {
          logger.error(
            'restarting the HoldRequestConsumer Lambda; the Patron Service returned a 5xx status code',
            { debugInfo: error }
          );

          return callback(error);
        }

        // Recoverable Error: The OAuth Service returned a 200 response however, the access_token was not defined; will attempt to restart handler.
        if (error.errorType === 'empty-access-token-from-oauth-service') {
          logger.error(
            'restarting the HoldRequestConsumer Lambda; the OAuth service returned a 200 response but the access_token value is empty',
            { debugInfo: error }
          );

          return callback(error);
        }

        // Recoverable Error: OAuth Token expired error
        if (error.errorType === 'access-token-invalid' && error.errorStatus === 401) {
          logger.error(
            'restarting the HoldRequestConsumer Lambda; OAuth access_token has expired, cannot continue fulfilling NYPL Data API requests',
            { debugInfo: error }
          );

          logger.info('setting the CACHED acccess_token to null before restarting the HoldRequestConsumer Lambda');
          CACHE.setAccessToken(null);

          return callback(error);
        }

        // Non-Recoverable Error: Any SCSB API error should NOT execute a restart
        if (error.errorType === 'scsb-api-error') {
          logger.error(
            'the HoldRequestConsumer Lambda will not restart; the SCSB API Service returned a 5xx status code',
            { debugInfo: error }
          );

          return false;
        }

        // Non-recoverable Error: The permissions scopes are invalid which originate from the .env file
        if (error.errorType === 'access-forbidden-for-scopes' && error.errorStatus === 403) {
          logger.error(
            'the HoldRequestConsumer Lambda caught a FATAL error and will NOT restart; OAuth scopes are forbidden, cannot continue fulfilling NYPL Data API requests',
            { debugInfo: error }
          );

          return false;
        }

        if (error.errorStatus !== 401) {
          logger.error(
            'the HoldRequestConsumer Lambda caught a FATAL error and will NOT restart; the reponse statusCode is NOT 401 OR 5XX (recoverable errors)',
            { debugInfo: error }
          );

          return false;
        }
      } else {
        // Log any other possible error
        logger.notice(
          'a possible error occured, the Hold Request Consumer Lambda will handle retires only on recoverable errors based on the errorType and errorCode',
          { debugInfo: error }
        );
      }
    });
  } catch (error) {
    // Non-recoverable Error: Function arguments are missing from .env file -- cannot begin promise chain without them
    logger.error(
      `fatal error: ${error.errorMessage}`,
      { type: error.errorType, function: error.function, debugInfo: error }
    );

    return error;
  }
};

exports.handler = (event, context, callback) => {
  if (event && Array.isArray(event.Records) && event.Records.length > 0) {
    const record = event.Records[0];
    // Handle Kinesis Stream
    if (record.kinesis && record.kinesis.data) {
      return exports.kinesisHandler(
        event.Records,
        { schemaName: process.env.HOLD_REQUEST_SCHEMA_NAME,
          resultStreamName: process.env.HOLD_REQUEST_RESULT_STREAM_NAME,
          nyplDataApiBaseUrl: process.env.NYPL_DATA_API_URL,
          scsbApiBaseUrl: process.env.SCSB_API_BASE_URL,
          scsbApiKey: process.env.SCSB_API_KEY,
          oAuthProviderUrl: process.env.OAUTH_PROVIDER_URL,
          oAuthClientId: process.env.OAUTH_CLIENT_ID,
          oAuthClientSecret: process.env.OAUTH_CLIENT_SECRET,
          oAuthProviderScope: process.env.OAUTH_PROVIDER_SCOPE
        },
        context,
        callback
      );
    }

    return callback('the event.Records array does not contain a kinesis stream of records to process');
  }

  return callback('the event.Records array is undefined');
};
