import type { AuditAction } from "@modules/domain/audit"

/** What appending a line takes: who did what to which target, and when. */
export interface AppendLogLineRequest {
    /** The acting person, or the system actor. */
    readonly actorId: string
    /** What happened. */
    readonly action: AuditAction
    /** What it touched, null when nothing. */
    readonly target: string | null
    /** When it happened. */
    readonly at: Date
}

/** The line that was appended. Appending a line cannot be refused: the queue redelivers a failure. */
export interface AppendLogLineResult {
    /** The chain position of the line. */
    readonly lineId: string
}
