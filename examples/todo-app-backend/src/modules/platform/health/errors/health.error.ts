import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the health capability. */
export enum HealthErrorCode {
    /** At least one dependency did not answer; the state of each rides in the params. */
    DependencyUnavailable = "HEALTH_DEPENDENCY_UNAVAILABLE",
}

/** How each health code travels. */
export const HEALTH_ERROR_KINDS: Record<HealthErrorCode, ErrorKind> = {
    [HealthErrorCode.DependencyUnavailable]: "unavailable",
}

/** The one error class of the health capability. */
export class HealthError extends DomainError<HealthErrorCode> {}
