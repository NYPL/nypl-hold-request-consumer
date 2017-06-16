# NYPL Hold Request Consumer Lambda

An AWS Lambda written in Node JS, responsible for listening to a stream of Hold Requests and sending all valid data to the appropriate Provider.

## Version
> v0.0.1

## Requirements
> [Node 6.10.0](https://nodejs.org/docs/v6.1.0/api/)

## Getting Started

### Installation

Install all Node dependencies via NPM
```console
$ npm install
```

### Setup Configurations

Once all dependencies are installed, you want to run the following NPM commands included in the `package.json` configuration file to setup a local development environment.

#### Step 1: Create `.env` file for `node-lambda` module
> Copies the sample .env file under ./sample/.env.sample into ./.env

```console
$ npm run setup-env
```

#### Step 2: Add your AWS environment variables
Once the `.env` file is copied, open the file and edit the following:
```console
AWS_ENVIRONMENT=development
AWS_ACCESS_KEY_ID=<YOUR KEY ID>
AWS_SECRET_ACCESS_KEY=<YOUR SECRET ACCESS KEY>
AWS_PROFILE=
AWS_SESSION_TOKEN=
AWS_ROLE_ARN=<ROLE OBTAINED FROM AWS CONSOLE>
AWS_REGION=us-east-1
AWS_FUNCTION_NAME=<FUNCTION NAME> (OPTIONAL)
AWS_HANDLER=index.handler
AWS_MEMORY_SIZE=128
AWS_TIMEOUT=3
AWS_DESCRIPTION=
AWS_RUNTIME=nodejs6.10
AWS_VPC_SUBNETS=
AWS_VPC_SECURITY_GROUPS=
AWS_TRACING_CONFIG=
EXCLUDE_GLOBS="event.json"
PACKAGE_DIRECTORY=build
```

#### Step 3: Setup your environment specific `{environment}.env` file
Running the following NPM Commands will:

* Set up your **QA** `.env` file as `./config/qa.env`
```console
$ npm run setup-qa-env
```

* Set up your **Production** `.env` file as `./config/prod.env`
```console
$ npm run setup-prod-env
```

These environment specific `.env` files will be used during the **deployment** process via the `node-lambda` module.

#### Step 4: Setup your environment specific `event_sources_{environment}.json` file
This file is used by the `node-lambda` module to deploy your Lambda with the correct mappings.

You **must** edit the file once created and add your specific **EventSourceArn** value, found in the AWS Console

Running the following NPM Commands will:

* Set up your **QA** `event_sources_qa.json` file in `./config/`
```console
$ npm run setup-qa-sources
```

* Set up your **Production** `event_sources_prod.json` file in `./config/`
```console
$ npm run setup-prod-sources
```

### Deploying your Lambda
To deploy your Lambda function via the `node-lambda` module __**ensure**__ you have completed all the steps of the [Setup](#setup-configurations) process and have added all configuration variables required.

The following NPM Commands will execute the `node-lambda deploy` command mapping configurations to the proper environments (qa & production). These commands can be modified in `package.json`.

* Deploys to **QA**
```console
$ npm run deploy-qa
```

* Deploys to **Production**
```console
$ npm run deploy-prod
```

### Developing Locally
To develop and run your Lambda locally you must ensure to complete `Step 1` and `Step 2` of the Setup process.

Next, run the following NPM command to use the **sample** event found in `./sample/sample_event.json`.

> Exceutes `node lambda run` pointing the the sample event.
```console
$ npm run local-run
```

### Running Tests
Unit tests are written using [Mocha](https://github.com/mochajs/mocha), [Chai](https://github.com/chaijs) and [Sinon](https://github.com/domenic/sinon-chai). All tests can be found under the `./test` directory. Mocha configurations are set and can be modified in `./test/mocha.opts`.

> To run test, use the following NPM script found in `package.json`.

```javascript
$ npm run test // Will run all tests found in the ./test/ path
```

```javascript
$ npm run test handler.test.js // Will run a specific test for the given filename
```
