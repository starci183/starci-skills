/** Exporting the caller data takes no input. */
export type ExportMyDataRequest = Readonly<Record<string, never>>

/** One exported line: the same shape the audit log reads. */
export interface ExportedLine {
    /** When the action happened. */
    readonly at: Date
    /** The action label. */
    readonly action: string
    /** What it touched. */
    readonly target: string | null
}

/** Every line naming the caller, decrypted; empty once the caller key was destroyed by a completed erasure. */
export interface ExportMyDataResult {
    /** The lines, oldest first. */
    readonly lines: ReadonlyArray<ExportedLine>
}
