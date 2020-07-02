/* eslint-disable semi */
const NyplStreamsClient = require('@nypl/nypl-streams-client');
const LambdaEnvVars = require('lambda-env-vars');
const HoldRequestConsumerModel = require('./src/models/HoldRequestConsumerModel');
const HoldRequestConsumerError = require('./src/models/HoldRequestConsumerError');
const ApiServiceHelper = require('./src/helpers/ApiServiceHelper');
const HoldingLocationHelper = require('./src/helpers/HoldingLocationHelper');
const logger = require('./src/helpers/Logger');
const CACHE = require('./src/globals/index');
const LambdaEnvVarsClient = new LambdaEnvVars.default();

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

    if (!opts.resultSchemaName || opts.resultSchemaName === '') {
      throw HoldRequestConsumerError({
        message: 'missing resultSchemaName configuration parameter',
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
    CACHE.setResultSchemaName(opts.resultSchemaName);
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
    .then(filteredUnprocessedRecords => hrcModel.validateRemainingRecordsToProcess(
      filteredUnprocessedRecords,
      'the lambda has completed processing; the hold request records array is empty; this occurs when records contained the proccessed flag set to TRUE and were filtered from further processing; no fatal errors have occured'
    ))
    .then(unprocessedRecords => {
      hrcModel.setRecords(unprocessedRecords);

      return hrcModel.filterScsbUiRecords(hrcModel.getRecords());
    })
    .then(filteredScsbRecordsToProcess => hrcModel.validateRemainingRecordsToProcess(
      filteredScsbRecordsToProcess,
      'the lambda has completed processing; the hold request records array is empty; records initiated from the SCSB UI have been filtered out resulting in an empty array; no fatal errors have occured'
    ))
    .then(remainingRecordsToProcess => {
      hrcModel.setRecords(remainingRecordsToProcess);

      return apiHelper.handleHttpAsyncRequests(
        hrcModel.getRecords(),
        'item-service',
        CACHE.getNyplDataApiBaseUrl(),
        CACHE.getAccessToken()
      );
    })
    .then(recordsWithItemData => hrcModel.validateRemainingRecordsToProcess(
      recordsWithItemData,
      'the lambda has completed processing; the hold request records array is empty and the lambda will not execute http GET requests to the Patron Service; this occurs when failed records have been filtered out and posted to the HoldRequestResult stream; no fatal errors have occured'
    ))
    .then(recordsToProcessWithItemData => {
      hrcModel.setRecords(recordsToProcessWithItemData);
      console.log("recordsToProcessWithItemData", recordsToProcessWithItemData);

      return apiHelper.handleHttpAsyncRequests(
        hrcModel.getRecords(),
        'patron-barcode-service',
        CACHE.getNyplDataApiBaseUrl(),
        CACHE.getAccessToken()
      );
    })
    .then(recordsWithPatronData => hrcModel.validateRemainingRecordsToProcess(
      recordsWithPatronData,
      'the lambda has completed processing; the hold request records array is empty and the lambda will not execute http POST requests to the SCSB API; this occurs when failed records have been filtered out and posted to the HoldRequestResult stream; no fatal errors have occured'
    ))
    .then(recordsToProcessWithPatronData => {
      hrcModel.setRecords(recordsToProcessWithPatronData);
      const holdLocationsApiData = {
        onSite: {
          apiBaseUrl: CACHE.getNyplDataApiBaseUrl(),
          apiKey: CACHE.getAccessToken(),
        },
        scsb: {
          apiBaseUrl: CACHE.getSCSBApiBaseUrl(),
          apiKey: CACHE.getSCSBApiKey(),
        }
      }

      return HoldingLocationHelper.handlePostingRecords(
        hrcModel.getRecords(),
        holdLocationsApiData
      )
    })
    .then(resultsOfRecordswithScsbResponse => {
      console.log("resultsOfRecordswithScsbResponse", resultsOfRecordswithScsbResponse);
      const successMsg = 'successfully completed Lambda execution without any fatal or recoverable errors';

      logger.info(successMsg);
      hrcModel.setRecords(resultsOfRecordswithScsbResponse);

      return callback(null, successMsg);
    })
    .catch(error => {
      // Non-recoverable Error: Avro Schema validation failed, do not restart Lambda
      if (error.name === 'AvroValidationError') {
        logger.error(
          'a fatal/non-recoverable AvroValidationError occured which prohibits decoding the kinesis stream; Hold Request Consumer Lambda will NOT restart',
          { debugInfo: error.message }
        );

        return false;
      }

      if (error.name === 'HoldRequestConsumerError') {
        // Not a fatal error but exited promise-chain due to filtered records resulting in an empty array
        if (error.errorType === 'filtered-records-resulted-in-empty-array') {
          return callback(null, error.errorMessage);
        }

        // Recoverable Error: The HoldRequestResult Stream returned an error, will attempt to restart handler.
        if (error.errorType === 'hold-request-result-stream-error') {
          logger.notice(
            'restarting the HoldRequestConsumer Lambda; received an error from the HoldRequestResult stream; unable to send POST requests to the HoldRequestResult stream',
            { debugInfo: error }
          );

          return callback(error.errorMessage);
        }

        // Recoverable Error: The OAuth Service returned a 200 response however, the access_token was not defined; will attempt to restart handler.
        if (error.errorType === 'empty-access-token-from-oauth-service') {
          logger.notice(
            'restarting the HoldRequestConsumer Lambda; the OAuth service returned a 200 response but the access_token value is empty',
            { debugInfo: error }
          );

          return callback(error.errorMessage);
        }

        // Recoverable Error: OAuth Token expired error
        if (error.errorType === 'access-token-invalid' && error.errorStatus === 401) {
          logger.info('setting the CACHED acccess_token to null before restarting the HoldRequestConsumer Lambda');
          CACHE.setAccessToken(null);

          logger.notice(
            'restarting the HoldRequestConsumer Lambda; OAuth access_token has expired, cannot continue fulfilling NYPL Data API requests',
            { debugInfo: error }
          );

          return callback(error.errorMessage);
        }

        // Recoverable Error: The OAuth Service might be down, will attempt to restart handler.
        if (error.errorType === 'oauth-service-error' && (error.hasOwnProperty('errorStatus') === false || error.errorStatus >= 500)) {
          logger.notice(
            'restarting the HoldRequestConsumer Lambda; the OAuth service returned a 5xx status code',
            { debugInfo: error }
          );

          return callback(error.errorMessage);
        }

        // Recoverable Error: The Item Service might be down, will attempt to restart handler.
        if (error.errorType === 'item-service-error' && (error.hasOwnProperty('errorStatus') === false || error.errorStatus >= 500)) {
          logger.notice(
            'restarting the HoldRequestConsumer Lambda; the Item Service returned a 5xx status code',
            { debugInfo: error }
          );

          return callback(error.errorMessage);
        }

        // Recoverable Error: The Patron Service might be down, will attempt to restart handler.
        if (error.errorType === 'patron-service-error' && (error.hasOwnProperty('errorStatus') === false || error.errorStatus >= 500)) {
          logger.notice(
            'restarting the HoldRequestConsumer Lambda; the Patron Service returned a 5xx status code',
            { debugInfo: error }
          );

          return callback(error.errorMessage);
        }

        // Non-Recoverable Error: Any SCSB API error should NOT execute a restart
        if (error.errorType === 'scsb-api-error') {
          logger.notice(
            'the HoldRequestConsumer Lambda will NOT restart; the SCSB API Service returned an error; SCSB API errors are considered non-retryable',
            { debugInfo: error }
          );

          return false;
        }

        // Non-recoverable Error: The permissions scopes are invalid which originate from the .env file
        if (error.errorType === 'access-forbidden-for-scopes' && error.errorStatus === 403) {
          logger.notice(
            'the HoldRequestConsumer Lambda caught a FATAL error and will NOT restart; OAuth scopes are forbidden, cannot continue fulfilling NYPL Data API requests',
            { debugInfo: error }
          );

          return false;
        }

        if (error.errorStatus && error.errorStatus !== 401) {
          logger.notice(
            'the HoldRequestConsumer Lambda caught an error and will NOT restart; the reponse statusCode is NOT 401 OR 5XX (recoverable errors)',
            { debugInfo: error }
          );

          return false;
        }
      }

      if (typeof error === 'string' || error instanceof String) {
        logger.error(
          `a fatal error occured, the Hold Request Consumer Lambda will NOT restart; ${error}`,
          { debugInfo: error }
        );

        return false;
      } else {
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
  const isProductionEnv = process.env.NODE_ENV === 'production';
  console.log("callback", callback);

  if (event && Array.isArray(event.Records) && event.Records.length > 0) {
    const record = event.Records[0];
    // Handle Kinesis Stream
    if (record.kinesis && record.kinesis.data) {
      // Execute the handler in local development mode, without decryption
      if (!isProductionEnv) {
        logger.info('executing kinesisHandler in local development mode');

        return exports.kinesisHandler(
          event.Records,
          { schemaName: process.env.HOLD_REQUEST_SCHEMA_NAME,
            resultStreamName: process.env.HOLD_REQUEST_RESULT_STREAM_NAME,
            resultSchemaName: process.env.HOLD_REQUEST_RESULT_SCHEMA_NAME,
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

      // Production decryption executed
      return LambdaEnvVarsClient.getCustomDecryptedValueList(
        [
          'OAUTH_CLIENT_ID',
          'OAUTH_CLIENT_SECRET',
          'OAUTH_PROVIDER_SCOPE',
          'SCSB_API_KEY'
        ],
        { location: 'lambdaConfig' })
        .then(resultObject => {
          return exports.kinesisHandler(
            event.Records,
            { schemaName: process.env.HOLD_REQUEST_SCHEMA_NAME,
              resultStreamName: process.env.HOLD_REQUEST_RESULT_STREAM_NAME,
              resultSchemaName: process.env.HOLD_REQUEST_RESULT_SCHEMA_NAME,
              nyplDataApiBaseUrl: process.env.NYPL_DATA_API_URL,
              scsbApiBaseUrl: process.env.SCSB_API_BASE_URL,
              scsbApiKey: resultObject.SCSB_API_KEY,
              oAuthProviderUrl: process.env.OAUTH_PROVIDER_URL,
              oAuthClientId: resultObject.OAUTH_CLIENT_ID,
              oAuthClientSecret: resultObject.OAUTH_CLIENT_SECRET,
              oAuthProviderScope: resultObject.OAUTH_PROVIDER_SCOPE
            },
            context,
            callback
          );
        })
        .catch(error => {
          logger.error(
            'an error occured while decrypting the Lambda ENV variables via LambdaEnvVarsClient',
            { debugInfo: error }
          );

          return callback(error);
        });
    }

    return callback(new Error('the event.Records array does not contain a kinesis stream of records to process'));
  }

  return callback(new Error('the event.Records array is undefined'));
};
