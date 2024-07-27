# web-fetch-client


[![npm version](https://img.shields.io/npm/v/web-fetch-client)](https://www.npmjs.com/package/web-fetch-client)

Simple REST client for web `fetch` module.

Has a single default export `request`.

Adds retries and timeout support to `fetch` module.

Adds default `JSON` support to the body and response.

Query parameters parsed from body.

Status code `>= 400` will cause a rejection of the call.

No dependencies.

### Example:

```
import request from 'web-fetch-client';

const body = {};
const headers = {};
const options = {};

const response = await request('POST', '/v1/endpoint', 'https://my-host.com', body, headers, options);
```

### Options:

    retry: number of retries, default 0
    response: response timeout in ms, default 10000
    deadline: deadline timeout in ms, default 60000
    verbose: should log warnings, default true

All options are optional.
