import { DomainError } from "../domain.error"
import type { ErrorKind } from "../errors.contracts"

/** Codes of the errors capability: the two answers it gives for failures no capability declared. */
export enum ErrorsErrorCode {
    /** A failure no capability declared; the transport masks its details. */
    Internal = "ERRORS_INTERNAL",
    /** The operation itself was malformed (syntax or schema validation) before any capability ran. */
    OperationInvalid = "ERRORS_OPERATION_INVALID",
}

/** How each errors code travels. */
export const ERRORS_ERROR_KINDS: Record<ErrorsErrorCode, ErrorKind> = {
    [ErrorsErrorCode.Internal]: "internal",
    [ErrorsErrorCode.OperationInvalid]: "invalid",
}

/** The one error class of the errors capability. */
export class ErrorsError extends DomainError<ErrorsErrorCode> {}
