/**
 * The only place raw `fetch` is allowed to appear (FE_FETCH_OUTSIDE_TRANSPORT). Every other module,
 * hook and component reaches the network through the named calls exported from this transport root.
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

/** The one shape every failed transport call throws, carrying the response status that produced it. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** The one options shape every transport call may pass through to fetch. */
export interface RequestOptions {
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly token?: string | null;
  readonly body?: unknown;
}

/** The one call that reaches the network; every other module resolves a response or an ApiError through it. */
export const apiRequest = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(response.status, typeof payload?.message === 'string' ? payload.message : response.statusText);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
};
