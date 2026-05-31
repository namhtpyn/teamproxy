export interface GraphRequestOptions {
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH'
  path?: string
  /** Full URL (e.g. @odata.nextLink). When set, `path` and `query` are ignored. */
  rawUrl?: string
  body?: unknown
  query?: Record<string, string>
  accessToken: string
}

export interface ODataError {
  error: {
    code: string
    message: string
  }
}

export const TOKEN_ENDPOINT = 'https://login.microsoftonline.com'
