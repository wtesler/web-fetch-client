# https-client


[![npm version](https://img.shields.io/npm/v/https-client)](https://www.npmjs.com/package/https-client)

Simple REST client for `node.js` `https` module.

Has a single default export `request`.

Adds retries and timeout support to `https` module.

Adds default `JSON` support to the body and response.

Query parameters parsed from body.

Status code `>= 400` will cause a rejection of the call.

No dependencies other than `https` module.

### Example:

```
const request = require('https-client');
const body = {};
const headers = {};
const options = {};

const abortController = new AbortController();
const signal = abortController.signal;

const response = await request('POST', '/v1/endpoint', 'my-host.com', body, headers, options, signal);
```

### Options:

    port: The port, default 443
    retry: number of retries, default 0
    rejectUnauthorized: Whether we should reject unauthorized responses, default true
    response: response timeout in ms, default 10000
    deadline: deadline timeout in ms, default 60000
    useHttp: Whether we should use http instead of https. Defaults to false.
    verbose: should log warnings, default true

All options are optional.

### onChunk

`request` has an optional `onChunk` parameter which is a function that receives Buffers as chunks
while the request is underway. If passed in, the overall response will be empty and you can
reconstruct the response manually from the chunks. Can be used for response streaming.
