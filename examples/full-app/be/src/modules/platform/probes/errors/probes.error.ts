import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the probes capability. */
export enum ProbesErrorCode {
    /** At least one dependency did not answer; the state of each rides in the params. */
    DependencyUnavailable = "PROBES_DEPENDENCY_UNAVAILABLE",
}

/** How each probes code travels. */
export const PROBES_ERROR_KINDS: Record<ProbesErrorCode, ErrorKind> = {
    [ProbesErrorCode.DependencyUnavailable]: "unavailable",
}

/** The one error class of the probes capability. */
export class ProbesError extends DomainError<ProbesErrorCode> {}
