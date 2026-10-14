import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the liveness capability. */
export enum LivenessErrorCode {
    /** A required dependency did not answer its readiness probe. */
    Unavailable = "LIVENESS_UNAVAILABLE",
}

/** How each liveness code travels. */
export const LIVENESS_ERROR_KINDS: Record<LivenessErrorCode, ErrorKind> = {
    [LivenessErrorCode.Unavailable]: "unavailable",
}

/** The one error class of the liveness capability. */
export class LivenessError extends DomainError<LivenessErrorCode> {}
