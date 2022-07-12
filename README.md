# NYPL Hold Request Consumer Lambda
[![Coverage Status](https://coveralls.io/repos/github/NYPL/nypl-hold-request-consumer/badge.svg?branch=master)](https://coveralls.io/github/NYPL/nypl-hold-request-consumer?branch=master)
[![Build Status](https://travis-ci.org/NYPL/nypl-hold-request-consumer.svg?branch=master)](https://travis-ci.org/NYPL/nypl-hold-request-consumer)
[![Dependency Status](https://gemnasium.com/badges/github.com/NYPL/nypl-hold-request-consumer.svg)](https://gemnasium.com/github.com/NYPL/nypl-hold-request-consumer)

An AWS Lambda written in Node JS, responsible for listening to a stream of Hold Requests and sending all valid data to the appropriate Provider. See [this writeup](https://github.com/NYPL/lsp_workflows/blob/master/workflows/patron_hold_request.md) and [this diagram](https://docs.google.com/presentation/d/1WorDgAffT3Hy5ZNGbbFYIEFKhRH4Mv_oiRHbaMmArmU/edit#slide=id.g8d85cf9fcf_0_64) for more context. The app essentially listens for newly created hold-requests broadcast by the HoldRequest service and performs the necessary work depending on the type of hold request:
 - If the hold-request was placed in RC for an item in ReCAP, the app will hit the SCSB API
 - If the hold-request was placed in RC for an on-site item, the app will hit [the OnSiteHoldRequestService](https://github.com/NYPL/on-site-hold-request-service)

## Table of Contents
- [Requirements](#requirements)
- Getting Started
  - [Installation](#installation)
  - [Setup Configurations](#setup-configurations)
  - [Developing Locally](#developing-locally)
  - [Tests](#tests)
  - [Linting](#linting)
- [Dependencies](#npm-dependencies)

## Version
> v1.0

## Requirements
> [Node 6.10.1](https://nodejs.org/docs/v6.10.1/api/)

## Getting Started

### Installation

Install all Node dependencies via NPM
```console
$ npm install
```

### Setup Configurations

All deployment configuration is versioned in `./config/`. *However..*

The app expects one secret configuration param - `SLACK_WEBHOOK_URL` - to be plaintext. For the purpose of putting all configuration in source control, we've gone ahead and encrypted it as `SLACK_WEBHOOK_URL_ENCRYPTED`. The actual deployed variable remains plaintext and named `SLACK_WEBHOOK_URL`. Thus, Travis can safely deploy to any environment without overwriting the *real* param. We should correct this situtation in the future by modifying the app to decrypt `SLACK_WEBHOOK_URL`. (Update: Note that SLACK_WEBHOOK_URL is no longer used in deployed code, so we may consider retiring this feature.)

#### Changes to SCSB/UAT endpoints

When HTC changes the SCSB endpoint, apply changes to the relevant environment file in `config/`. `SCSB_API_BASE_URL` should be plain text. `SCSB_API_KEY` should be encrypted. Merging should deploy changes.

### Developing Locally

To develop and run your Lambda locally you must ensure to complete `Step 1` and `Step 2` of the Setup process.

***Note:*** Your `./config/local.env` ***MUST*** be configured in order for the next step to work.

This will execute the sample event in `event.json`:

```console
$ npm run run-local
```

There are three more sample events in the `events` folder:
- DiscoveryEvent.json, simulating a hold request from Discovery UI
- RecapEvent.json, simulating a hold request from Recap UI
- EddEvent.json, simulating an edd request from Discovery UI.

For details about how each of these events will be processed, see the github repo for the HoldRequestService: https://github.com/NYPL/hold-request-service. As documented there, only the edd request will be passed to the HoldRequestResult stream, and the others will be filtered out. Be aware that if you modify the events they may not be handled as expected by downstream processes since the HoldRequestResultConsumer relies on holds existing in the database.


### Deploying your Lambda

Travis is configured to deploy automatically on updates to origin/development, origin/qa, and origin/master (i.e. production).

Deployments (AWS account `nypl-digital-dev`):
 * Production: Lambda > Functions > HoldRequestConsumer-production
 * QA: Lambda > Functions > HoldRequestConsumer-qa

To manually deploy:

```
npm run deploy-[development|qa|production]
```

### Tests
#### Test Coverage
[Istanbul](https://github.com/istanbuljs/nyc) is currently used in conjunction with Mocha to report coverage of all unit tests.

Simply run:
```javascript
$ npm run coverage-report
```

Executing this NPM command will create a `./coverage/` folder with an interactive UI reporting the coverage analysis, now you can open up `./coverage/index.html` in your browser to view an enhanced report.

#### Running Unit Tests
Unit tests are written using [Mocha](https://github.com/mochajs/mocha), [Chai](https://github.com/chaijs) and [Sinon](https://github.com/domenic/sinon-chai). All tests can be found under the `./test` directory. Mocha configurations are set and can be modified in `./test/mocha.opts`.

> To run test, use the following NPM script found in `package.json`.

```javascript
$ npm run test // Will run all tests found in the ./test/ path
```

```javascript
$ npm run test [filename].test.js // Will run a specific test for the given filename
```
### Linting
This codebase ~~currently~~ aspires to use [Standard JS](https://www.npmjs.com/package/standard) as the JavaScript linter. (Ed. note: Semi-colons abound.)

To lint files use the following NPM command:
```javascript
$ npm run lint // Will lint all files except those listed in package.json under standard->ignore
```

```javascript
$ npm run lint [filename].js // Will lint the specific JS file
```

## Git Workflow

This repo follows a common [Development-QA-Main](hhttps://github.com/NYPL/engineering-general/blob/master/standards/git-workflow.md#development-qa-main) git workflow (without tagging or CHANGELOG):

 - Cut feature branch from `development`
 - After approval, merge into `development`
 - Merge `development` > `qa`
 - Merge `qa` > `master`

## NPM Dependencies
* [nypl-streams-client](https://www.npmjs.com/package/@nypl/nypl-streams-client)
* [nypl-scsb-rest-client](https://www.npmjs.com/package/@nypl/scsb-rest-client)
* [aws-sdk](https://www.npmjs.com/package/aws-sdk)
* [async](https://www.npmjs.com/package/async)
* [axios](https://www.npmjs.com/package/axios)
* [circular-json](https://www.npmjs.com/package/circular-json)
* [lambda-env-vars](https://www.npmjs.com/package/lambda-env-vars)
* [qs](https://www.npmjs.com/package/qs)
* [winston](https://www.npmjs.com/package/winston)
* [winston-slack-hook](https://www.npmjs.com/package/winston-slack-hook)
* [node-lambda](https://www.npmjs.com/package/node-lambda)
* [mocha](https://www.npmjs.com/package/mocha)
* [chai](https://www.npmjs.com/package/chai)
* [coveralls](https://www.npmjs.com/package/coveralls)
* [sinon](https://www.npmjs.com/package/sinon)
* [sinon-chai](https://www.npmjs.com/package/sinon-chai)
* [standard-js](https://www.npmjs.com/package/standard)
* [istanbul](https://github.com/istanbuljs/nyc)
