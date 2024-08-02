export default class WebFetchClient {
  /**
   * Make a network request to the given host.
   *
   * @param type {String} REST method to use. For example 'GET', 'POST', 'PUT', 'DELETE'.
   * @param path {String} Endpoint path. For example '/api/v1/users'.
   * @param host {String} Host to call. Example: https://api.example.com
   * @param body {any} Optional object or data to send. Works for all methods including `GET`.
   * @param headers {any} Optional object to send. May contain things like API Key, etc.
   * @param options {any} Optional properties object, may contain the following fields:
   * `response`: Number of ms to wait for the initial response. Defaults to 10000.
   * `deadline`: Number of ms to wait for the entire request. Defaults to 60000.
   * `retry`: Number of times to retry the request. Defaults to 0.
   * `verbose`: Whether to print the rejections as warnings. Defaults to true.
   * @param fetchObj The fetch object to use. Defaults to browser built-in fetch.
   * @return {Promise<Object>} The resolved or rejected response.
   * If `Accept` header is application/json, the response will be parsed as JSON and a status code assigned to it.
   * Otherwise, a response object is created and the response is set to the `data` property.
   */
  static async request(type, path, host, body = {}, headers = {}, options = {}, fetchObj=fetch) {
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
      verbose: false
    };

    // Options projected onto default options.
    options = Object.assign(defaultOptions, options);

    // Extract options.
    const responseTimeMs = options.response;
    const deadlineTimeMs = options.deadline;
    const retry = options.retry;
    const verbose = options.verbose;

    type = type.toUpperCase();

    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json'; // Common situation handled here.
    }

    if (!headers['Accept']) {
      headers['Accept'] = 'application/json'; // Common situation handled here.
    }

    const requestOptions = {
      method: type,
      headers: headers
    }

    if (type === 'POST' || type === 'PUT' || type === 'DELETE') {
      if (headers['Content-Type'].includes('application/json')) {
        body = JSON.stringify(body);
      }

      if (!headers['Content-Length']) {
        headers['Content-Length'] = body.length;
      }

      requestOptions.body = body;
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

      const TIMEOUT = 'Web Fetch Client Timeout';

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

      const responsePromise = new Promise(async(resolve) => {
        try {
          const response = await fetchObj(`${host}${path}`, requestOptions);

          if (verbose) {
            console.log(response);
          }

          const statusCode = response.status;

          if (didTimeout) {
            resolve();
          }

          cancelResponseTimeout();
          clearTimeout(deadlineTimeout);

          let responseContent = null;

          if (headers['Accept'] === 'application/json') {
            try {
              responseContent = await response.json();
              if (!responseContent.statusCode) {
                responseContent.statusCode = statusCode;
              }
            } catch (e) {
              // Everything is fine.
            }
          }

          if (!responseContent) {
            responseContent = {
              data: await response.text(),
              statusCode: statusCode
            };
          }

          if (statusCode >= 400) {
            logWarning(responseContent);
            const serverError = new Error(`Received not OK status code with call to ${host}${path}`);
            serverError.statusCode = statusCode;
            if (typeof responseContent === 'string') {
              serverError.message = `Received ${statusCode} code. Response treated as rejection. Full response: ${responseContent}`;
            } else {
              Object.assign(serverError, responseContent);
            }
            resolve(serverError);
          } else {
            // Success
            didSucceed = true;
            resolve(responseContent);
          }
        } catch (e) {
          cancelResponseTimeout();
          logWarning(e);
          resolve(e)
        }
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
