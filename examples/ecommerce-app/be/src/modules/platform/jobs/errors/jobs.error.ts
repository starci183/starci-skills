import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the jobs capability. */
export enum JobsErrorCode {
    /** A write carried a fencing token that is no longer the job's: a newer worker owns it. */
    FencedOut = "JOBS_FENCED_OUT",
}

/** How each jobs code travels. */
export const JOBS_ERROR_KINDS: Record<JobsErrorCode, ErrorKind> = {
    [JobsErrorCode.FencedOut]: "conflict",
}

/** The one error class of the jobs capability. */
export class JobsError extends DomainError<JobsErrorCode> {}
