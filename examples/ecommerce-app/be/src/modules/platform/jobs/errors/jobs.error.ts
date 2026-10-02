import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the jobs capability. */
export enum JobsErrorCode {
    /** A write carried a fencing token that is no longer the job's: a newer worker owns it. */
    FencedOut = "JOBS_FENCED_OUT",
    /** A run key could not be made: the job id or the step name carries a separator. */
    RunKeyInvalid = "JOBS_RUN_KEY_INVALID",
    /** The jobs capability was registered with no connection to hold the job table. */
    ConnectionMissing = "JOBS_CONNECTION_MISSING",
}

/** How each jobs code travels. */
export const JOBS_ERROR_KINDS: Record<JobsErrorCode, ErrorKind> = {
    [JobsErrorCode.FencedOut]: "conflict",
    [JobsErrorCode.RunKeyInvalid]: "internal",
    [JobsErrorCode.ConnectionMissing]: "internal",
}

/** The one error class of the jobs capability. */
export class JobsError extends DomainError<JobsErrorCode> {}
