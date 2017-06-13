# NYPL Hold Request Consumer Lambda

An AWS Lambda written in Node JS, responsible for listening to a stream of Hold Requests and sending all valid data to the appropriate Provider.

## Requirements
* Node 6.10.0 - List of JavaScript features supported

## Getting Started

### Installation

Install all Node dependencies via NPM
```console
$ npm install
```

### Setup for Local Development

Once all dependencies are installed, you want to run the following NPM commands included in the `package.json` configuration file to setup a local development environment.

> Copies the sample .env file under ./sample/.env.sample into ./config/.env

```console
$ npm run setup
```

Once the `.env` file is copied, you will be able to edit the following:
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

### Running Tests
Unit tests are written using Mocha, Chai and Sinon. All tests can be found under `./test`. Mocha configurations are established in `./test/mocha.opts`.

> To run test, use the following NPM script found in `package.json`.

```javascript
$ npm run test // Will run all tests found in the ./test/ path
```

```javascript
$ npm run test handler.test.js // Will run a specific test for the given filename
```
