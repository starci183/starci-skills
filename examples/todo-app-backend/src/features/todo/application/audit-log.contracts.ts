import type { AuditErrorCode } from "@modules/domain/audit"
import type { Outcome } from "@modules/platform/primitives"

/** What reading the audit log takes: an optional filter, honoured for administrators only. */
export interface AuditLogRequest {
    /** Only lines of this action, when set. */
    readonly action: string | null
    /** Only lines of this target, when set. */
    readonly target: string | null
}

/** One decrypted line: the actor and the key id never leave the server. */
export interface AuditLogLine {
    /** When the action happened. */
    readonly at: Date
    /** The action label. */
    readonly action: string
    /** What it touched. */
    readonly target: string | null
}

/** The lines the caller may read. */
export interface AuditLogRead {
    /** The lines, oldest first. */
    readonly lines: ReadonlyArray<AuditLogLine>
}

/** The lines the caller may read, or the refusal that names why the log was not read. */
export type AuditLogResult = Outcome<AuditLogRead, AuditErrorCode>
