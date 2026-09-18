/**
 * The one place raw `fetch` is allowed to appear (FE_FETCH_OUTSIDE_TRANSPORT). Every other module, hook
 * and component reaches the network through the named calls exported from `auth.ts`/`tasks.ts`, which
 * all go through this one GraphQL fetcher - matching nivo-fe's own `modules/api/graphql.ts` shape.
 *
 * Renamed from the former REST `client.ts` (`apiRequest`/`ApiError` over `fetch(BASE_URL + path, ...)`)
 * because the backend's transport moved to GraphQL on `ex-nivo-shape`: one endpoint, one POST, one
 * document per operation, and a refusal arrives as `errors[0]` with the domain's stable code on
 * `extensions.code` (see the backend's `graphql.module.ts` `formatError`) rather than as an HTTP status.
 *
 * THE SESSION TOKEN STAYS AN EXPLICIT PARAMETER, not a registered reader the way nivo-fe's access token
 * is: every call site in this example already threads `token` through `auth.ts`/`tasks.ts` (`listTasks
 * (token)`, `createTask(token, title)`, ...), and the hooks read it themselves via `useSessionToken()`.
 * Keeping that shape is what "hooks and blocks keep their contracts" means here - this module only
 * changes how a call reaches the network, not who supplies the credential.
 */
const ENDPOINT = process.env.NEXT_PUBLIC_API_GRAPHQL_URL ?? 'http://localhost:3001/graphql';

/** What a caller gets back: the payload, or the reason there is none. */
export type Result<T> = {
  readonly ok: true;
  readonly data: T;
} | {
  readonly ok: false;
  readonly reason: string;
  readonly code?: string;
};

/**
 * Run one GraphQL operation.
 *
 * NEVER THROWS. Every call site is a submit handler, a mutation or a query fetcher, and each has
 * something better to show than a stack trace: the refusal's own sentence/code. A thrown error inside a
 * submit would leave the form in its pending state forever - `auth.ts`/`tasks.ts` are what turn a
 * refused `Result` back into a thrown `Error` at the one or two call sites that still want that.
 *
 * @param query - The operation document.
 * @param variables - Its variables, if any.
 * @param token - The caller's own session token, sent as `Authorization: Bearer <token>` - the same
 *   header name and value shape nivo-fe's own graphql.ts sends its access token with - omitted for
 *   sign-in/sign-out.
 * @returns The unwrapped payload, or why there is none.
 */
export const graphql = async <T,>(
  query: string,
  variables?: Readonly<Record<string, unknown>>,
  token?: string | null,
): Promise<Result<T>> => {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query, variables: variables ?? {} }),
    });
  } catch {
    return { ok: false, reason: 'network', code: 'NETWORK' };
  }
  let body: {
    data?: Record<string, unknown>;
    errors?: ReadonlyArray<{ message: string; extensions?: { code?: string } }>;
  };
  try {
    body = await response.json();
  } catch {
    return { ok: false, reason: 'malformed', code: 'MALFORMED' };
  }
  if (body.errors !== undefined && body.errors.length > 0) {
    return { ok: false, reason: body.errors[0].message, code: body.errors[0].extensions?.code };
  }
  const payload = body.data === undefined ? undefined : Object.values(body.data)[0];
  if (payload === undefined) {
    return { ok: false, reason: 'empty', code: 'EMPTY' };
  }
  return { ok: true, data: payload as T };
};
