import { DomainError } from "../domain.error"
import type { ErrorKind } from "../errors.contracts"

/** Codes of the errors capability: the answer it gives for a failure no capability declared. */
export enum ErrorsErrorCode {
    /** A failure no capability declared; the transport masks its details. */
    Internal = "ERRORS_INTERNAL",
}

/** How each errors code travels. */
export const ERRORS_ERROR_KINDS: Record<ErrorsErrorCode, ErrorKind> = {
    [ErrorsErrorCode.Internal]: "internal",
}

/** The one error class of the errors capability. */
export class ErrorsError extends DomainError<ErrorsErrorCode> {}
