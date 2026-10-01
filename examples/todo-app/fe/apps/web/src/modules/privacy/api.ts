import { isRecord, parseList, parseOutcome, request, unwrap } from "@/modules/api"

/**
 * The privacy screen's transport adapter: the GraphQL documents the audit backend already serves
 * (fr.audit.export's `exportMyData` query and fr.audit.erasure.request/complete's `requestErasure` /
 * `completeErasure` mutations).
 */

/** One decrypted audit line `exportMyData` returns for the calling person. */
interface AuditLine {
    readonly at: string
    readonly action: string
    readonly target: string
}

/** What `requestErasure` and `completeErasure` both return. */
interface ErasureRequest {
    readonly requestId: string
    readonly state: string
}

/** One audit line of the wire, or `null` when the row is not that shape. */
const toAuditLine = (row: unknown): AuditLine | null =>
    isRecord(row) && typeof row.at === "string" && typeof row.action === "string" && typeof row.target === "string"
        ? { at: row.at, action: row.action, target: row.target }
        : null

/** The audit lines of a payload. */
const toAuditLines = (data: unknown): ReadonlyArray<AuditLine> | null => parseList(data, toAuditLine)

/** The erasure request of a payload, or `null` when the payload is not that shape. */
const toErasureRequest = (data: unknown): ErasureRequest | null =>
    isRecord(data) && typeof data.requestId === "string" && typeof data.state === "string"
        ? { requestId: data.requestId, state: data.state }
        : null

/** fr.audit.export: the caller's own decrypted audit lines; an empty list once the key is destroyed. */
export const exportMyData = async (token: string): Promise<ReadonlyArray<AuditLine>> =>
    unwrap(parseOutcome(await request({ operation: "ExportMyData", token }), toAuditLines))

/** fr.audit.erasure.request: files the caller's request; the backend verifies the session identity. */
export const requestErasure = async (token: string): Promise<ErasureRequest> =>
    unwrap(parseOutcome(await request({ operation: "RequestErasure", token }), toErasureRequest))

/** fr.audit.erasure.complete: destroys the caller's key so their lines become unreadable. */
export const completeErasure = async (token: string, requestId: string): Promise<ErasureRequest> =>
    unwrap(
        parseOutcome(
            await request({ operation: "CompleteErasure", variables: { requestId }, token }),
            toErasureRequest,
        ),
    )
