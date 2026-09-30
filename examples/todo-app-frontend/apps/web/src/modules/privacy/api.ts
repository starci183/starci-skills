import { graphql, unwrap } from "@/modules/api"

/**
 * The privacy screen's transport adapter: the GraphQL documents the audit backend already serves
 * (fr.audit.export's `exportMyData` query and fr.audit.erasure.request/complete's `requestErasure` /
 * `completeErasure` mutations). The privacy capability owns these calls and uses the shared GraphQL transport.
 */

/** One decrypted audit line `exportMyData` returns for the calling person. */
interface AuditLine {
  readonly at: string;
  readonly action: string;
  readonly target: string;
}

/** What `requestErasure` and `completeErasure` both return. */
interface ErasureRequest {
  readonly requestId: string;
  readonly state: string;
}

const EXPORT_MY_DATA_DOCUMENT = "query { exportMyData { at action target } }"

/** fr.audit.export: the caller's own decrypted audit lines; an empty list once the key is destroyed. */
export const exportMyData = async (token: string): Promise<ReadonlyArray<AuditLine>> => {
    return unwrap(await graphql<ReadonlyArray<AuditLine>>(EXPORT_MY_DATA_DOCUMENT, undefined, token))
}

const REQUEST_ERASURE_DOCUMENT = "mutation { requestErasure { requestId state } }"

/** fr.audit.erasure.request: files the caller's request; the backend verifies the session identity. */
export const requestErasure = async (token: string): Promise<ErasureRequest> => {
    return unwrap(await graphql<ErasureRequest>(REQUEST_ERASURE_DOCUMENT, undefined, token))
}

const COMPLETE_ERASURE_DOCUMENT =
  "mutation CompleteErasure($requestId: ID!) { completeErasure(request: { requestId: $requestId }) { requestId state } }"

/** fr.audit.erasure.complete: destroys the caller's key so their lines become unreadable. */
export const completeErasure = async (token: string, requestId: string): Promise<ErasureRequest> => {
    return unwrap(await graphql<ErasureRequest>(COMPLETE_ERASURE_DOCUMENT, { requestId }, token))
}
