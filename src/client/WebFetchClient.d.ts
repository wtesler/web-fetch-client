/**
 * Options for configuring request timeouts, retries, and verbosity.
 */
export interface Options {
  /** Time in ms to wait for initial response */
  response?: number;
  /** Time in ms to wait for full request completion */
  deadline?: number;
  /** Number of times to retry on failure */
  retry?: number;
  /** Whether to reject unauthorized SSL (unused in browser) */
  rejectUnauthorized?: boolean;
  /** Whether to use HTTP (unused in browser) */
  useHttp?: boolean;
  /** Whether to log detailed warnings */
  verbose?: boolean;
}

/**
 * HTTP headers for the request.
 */
export type Headers = Record<string, string>;
/**
 * Response wrapper including parsed body data and HTTP status code.
 */
export type Response<T> = T & { statusCode: number };

/**
 * Main client class providing a static request method.
 */
export default class WebFetchClient {
  /**
   * Make a network request to the given host.
   * @param type HTTP method, e.g., 'GET', 'POST', etc.
   * @param path Endpoint path, e.g., '/api/v1/users'.
   * @param host Host URL, e.g., 'https://api.example.com'.
   * @param body Optional request payload.
   * @param headers Optional HTTP headers.
   * @param options Optional settings: response timeout, deadline, retry count, etc.
   * @param fetchObj Optional fetch implementation; defaults to global fetch.
   * @returns A promise resolving to the parsed response or rejecting with an error.
   */
  static request<T = any>(
    type: string,
    path: string,
    host: string,
    body?: object | FormData,
    headers?: Headers,
    options?: Options,
    fetchObj?: typeof fetch
  ): Promise<Response<T>>;
}