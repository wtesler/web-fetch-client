export default class WebFetchClient {
  /**
   * Make a network request to the given host.
   *
   * @param type {String} REST method to use. For example 'GET', 'POST', 'PUT', 'DELETE'.
   * @param path {String} Endpoint path. For example '/api/v1/users'.
   * @param host {String} Host to call. Example: api.example.com
   * @param body {any} Optional object or data to send. Works for all methods including `GET`.
   * @param headers {any} Optional object to send. May contain things like API Key, etc.
   * @param options {any} Optional properties object, may contain the following fields:
   * `port`: Request on a port other than 443.
   * `response`: Number of ms to wait for the initial response. Defaults to 10000.
   * `deadline`: Number of ms to wait for the entire request. Defaults to 60000.
   * `retry`: Number of times to retry the request. Defaults to 0.
   * `rejectUnauthorized`: Whether we should reject unauthorized responses. Defaults to true.
   * `useHttp`: Whether we should use http instead of https. Defaults to false.
   * `verbose`: Whether to print the rejections as warnings. Defaults to true.
   *
   * @param abortSignal {AbortSignal} An optional abort signal which can be used to interrupt the request.
   * @param onChunk {function(Buffer)} An optional function which receives callbacks with chunks as they stream in.
   * If set, the overall response will not contain the data.
   * @return {Promise<Object>} The resolved or rejected response.
   * If `ACCEPT` is application/json, the response will be parsed as JSON and a status code assigned to it.
   * Otherwise, a response object is created and the response is set to the `data` property.
   */
  static async request(type, path, host, body = {}, headers = {}, options = {}, abortSignal = null, onChunk = null) {
    if (!body) {
      body = {};
    }

    if (!headers) {
      headers = {};
    }

    if (!options) {
      options = {};
    }

    const defaultOptions = {
      response: 10000,
      deadline: 60000,
      retry: 0,
      rejectUnauthorized: true,
      useHttp: false,
      verbose: true
    };

    // Options projected onto default options.
    options = Object.assign(defaultOptions, options);

    // Extract options.
    const port = options.port;
    const responseTimeMs = options.response;
    const deadlineTimeMs = options.deadline;
    const retry = options.retry;
    const rejectUnauthorized = options.rejectUnauthorized;
    const verbose = options.verbose;
    const useHttp = options.useHttp;

    const httpLib = useHttp ? require('http') : require('https');

    const httpStr = useHttp ? 'http' : 'https';
    if (host && host.startsWith(`${httpStr}://`)) {
      host = host.replace(`${httpStr}://`, '');
    }

    type = type.toUpperCase();

    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json'; // Common situation handled here.
    }

    if (!headers['Accept']) {
      headers['Accept'] = 'application/json'; // Common situation handled here.
    }

    if (type === 'POST' || type === 'PUT' || type === 'DELETE') {
      if (headers['Content-Type'].includes('application/json')) {
        body = JSON.stringify(body);
        body = Buffer.from(body, 'utf-8');
      }

      if (!headers['Content-Length']) {
        headers['Content-Length'] = body.length;
      }
    } else if (type === 'GET') {
      const keys = Object.keys(body);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const value = body[key];

        if (i === 0) {
          path += '?';
        }

        path += `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;

        if (i < keys.length - 1) {
          path += '&';
        }
      }
    } else {
      throw new Error(`Unsupported type: ${type}`);
    }

    const requestOptions = {
      hostname: host,
      path: path,
      method: type,
      headers: headers
    };

    if (port) {
      requestOptions.port = port;
    }

    if (abortSignal) {
      requestOptions.signal = abortSignal;
    }

    if (process.env.NODE_ENV === 'development' || !rejectUnauthorized) {
      requestOptions.rejectUnauthorized = false;
    }

    const logWarning = (str) => {
      if (verbose) {
        console.warn(str);
      }
    };

    let hasTried = false;
    let didSucceed = false;

    let numRetries = 0;

    while (!didSucceed && (!hasTried || numRetries <= retry)) {
      hasTried = true;

      let receivedAck = false;
      let didTimeout = false;

      let responseTimeout;
      let deadlineTimeout;

      const TIMEOUT = 'Https Client Timeout';

      /**
       * Resolves if timeout occurs while waiting for initial acknowledgement.
       */
      const responseTimeoutPromise = new Promise((resolve, reject) => {
        responseTimeout = setTimeout(() => {
          if (receivedAck) {
            reject(new Error('Timeout expired'));
          } else {
            didTimeout = true;
            resolve(`${TIMEOUT}. Response passed ${responseTimeMs} ms`);
          }
        }, responseTimeMs);
      });

      const cancelResponseTimeout = () => {
        receivedAck = true;
        if (responseTimeout) {
          clearTimeout(responseTimeout);
        }
        responseTimeout = null;
      };

      /**
       * Resolves if timeout occurs while waiting for response completion.
       */
      const deadlineTimeoutPromise = new Promise(resolve => {
        deadlineTimeout = setTimeout(() => {
          didTimeout = true;
          resolve(`${TIMEOUT}. Deadline passed ${deadlineTimeMs} ms`);
        }, deadlineTimeMs);
      });

      const buffer = Buffer;

      const responsePromise = new Promise(resolve => {
        const req = httpLib.request(requestOptions, res => {
          const data = [];

          const statusCode = res.statusCode;

          res.on('error', e => {
            cancelResponseTimeout();
            e.statusCode = statusCode;
            logWarning(e);
            resolve(e); // Network Error
          });
          res.on('data', chunk => {
            cancelResponseTimeout();
            if (onChunk) {
              try {
                onChunk(chunk);
              } catch (e) {
                logWarning(e);
                resolve(e);
              }
            } else {
              data.push(chunk);
            }
          });
          res.on('end', () => {
            if (didTimeout) {
              resolve();
              return;
            }

            cancelResponseTimeout();
            clearTimeout(deadlineTimeout);

            const responseStr = buffer.concat(data).toString();
            let response;
            if (headers['Accept'] === 'application/json') {
              try {
                response = JSON.parse(responseStr);
                if (!response.statusCode) {
                  response.statusCode = statusCode;
                }
              } catch (e) {
                // Everything is fine.
              }
            }

            if (!response) {
              response = {
                data: responseStr,
                statusCode: statusCode
              };
            }

            if (statusCode >= 400) {
              logWarning(response);
              let responseStr = response;
              const serverError = new Error(`Received not OK status code with call to ${host}${path}`);
              serverError.statusCode = statusCode;
              if (typeof response === 'string') {
                serverError.message = `Received ${statusCode} code. Response treated as rejection. Full response: ${responseStr}`;
              } else {
                Object.assign(serverError, response);
              }
              resolve(serverError);
            } else {
              // Success
              didSucceed = true;
              resolve(response);
            }
          });
        });

        if (abortSignal) {
          abortSignal.addEventListener('abort', () => {
            req.destroy();
            const error = new Error('Aborted');
            error.statusCode = 499;
            resolve(error);
          }, {once: true});
        }

        if (type === 'POST' || type === 'PUT' || type === 'DELETE') {
          req.write(body);
        }

        req.end();
      });

      const overallResponse = await Promise.any([responsePromise, Promise.any([responseTimeoutPromise, deadlineTimeoutPromise])]);

      const isTimeout = typeof overallResponse === 'string' && overallResponse.includes(TIMEOUT);
      const isError = overallResponse instanceof Error;

      if (isTimeout || isError) {
        if (numRetries === retry) {
          if (isTimeout) {
            const timeoutError = new Error(overallResponse);
            timeoutError.statusCode = 408;
            throw timeoutError;
          } else {
            const overallError = new Error(overallResponse.message);
            Object.assign(overallError, overallResponse);
            throw overallError;
          }
        } else {
          if (isTimeout) {
            logWarning("The network call timed out. Trying again...");
          } else {
            logWarning("The network call produced an error. Trying again...");
          }
        }
      } else {
        // Response was good. Return it.
        return overallResponse;
      }

      // Response was error or timeout. Trying again.
      numRetries++;
    }
  }
};
