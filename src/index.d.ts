import type { Options, Headers, Response } from './client/WebFetchClient';
/**
 * Main request function exported for simplicity.
 *
 * @typeParam T - expected response body type
 */
declare function request<T = any>(
  type: string,
  path: string,
  host: string,
  body?: any,
  headers?: Headers,
  options?: Options,
  fetchObj?: typeof fetch
): Promise<Response<T>>;

export default request;
/**
 * Re-export types for external use.
 */
export type { Options, Headers, Response };