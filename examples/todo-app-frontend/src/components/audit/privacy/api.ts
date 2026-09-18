import { graphql, type Result } from '@/modules/api/graphql';
import { signOut } from '@/modules/api/auth';

/**
 * The privacy screen's transport adapter: the GraphQL documents the audit backend already serves
 * (fr.audit.export's `exportMyData` query and fr.audit.erasure.request/complete's `requestErasure` /
 * `completeErasure` mutations) plus the one session call Sign out needs. It lives beside the block
 * rather than under `src/modules/api/` because this lane's write ceiling is `src/components/audit/**`;
 * the call/unwrap idiom is unchanged from `modules/api/tasks.ts`.
 */

/** One decrypted audit line `exportMyData` returns for the calling person. */
export interface AuditLine {
  readonly at: string;
  readonly action: string;
  readonly target: string;
}

/** What `requestErasure` and `completeErasure` both return. */
export interface ErasureRequest {
  readonly requestId: string;
  readonly state: string;
}

/** The same refusal-to-throw rule `modules/api/tasks.ts` applies to every failed Result. */
const unwrap = <T>(result: Result<T>): T => {
  if (!result.ok) {
    throw new Error(result.reason, result.code ? { cause: new Error(result.code) } : undefined);
  }
  return result.data;
};

const EXPORT_MY_DATA_DOCUMENT = 'query { exportMyData { at action target } }';

/** fr.audit.export: the caller's own decrypted audit lines; an empty list once the key is destroyed. */
export const exportMyData = async (token: string): Promise<ReadonlyArray<AuditLine>> => {
  return unwrap(await graphql<ReadonlyArray<AuditLine>>(EXPORT_MY_DATA_DOCUMENT, undefined, token));
};

const REQUEST_ERASURE_DOCUMENT = 'mutation { requestErasure { requestId state } }';

/** fr.audit.erasure.request: files the caller's request; the backend verifies the session identity. */
export const requestErasure = async (token: string): Promise<ErasureRequest> => {
  return unwrap(await graphql<ErasureRequest>(REQUEST_ERASURE_DOCUMENT, undefined, token));
};

const COMPLETE_ERASURE_DOCUMENT =
  'mutation CompleteErasure($requestId: ID!) { completeErasure(requestId: $requestId) { requestId state } }';

/** fr.audit.erasure.complete: destroys the caller's key so their lines become unreadable. */
export const completeErasure = async (token: string, requestId: string): Promise<ErasureRequest> => {
  return unwrap(await graphql<ErasureRequest>(COMPLETE_ERASURE_DOCUMENT, { requestId }, token));
};

/** Sign out ends the server session; clearing local state stays with the caller. */
export const endSession = async (token: string): Promise<boolean> => {
  return signOut(token);
};
