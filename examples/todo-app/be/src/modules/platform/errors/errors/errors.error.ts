import { DomainError } from "../domain.error"
import type { ErrorKind } from "../errors.contracts"

/** Codes of the errors capability: the answers it gives for failures no capability declared. */
export enum ErrorsErrorCode {
    /** A failure no capability declared; the transport masks its details. */
    Internal = "ERRORS_INTERNAL",
    /** The operation itself was malformed (syntax or schema validation) before any capability ran. */
    OperationInvalid = "ERRORS_OPERATION_INVALID",
    /** No route of the app matches the request: the framework's own not-found, answered as such, never masked. */
    RouteNotFound = "ERRORS_ROUTE_NOT_FOUND",
}

/** How each errors code travels. */
export const ERRORS_ERROR_KINDS: Record<ErrorsErrorCode, ErrorKind> = {
    [ErrorsErrorCode.Internal]: "internal",
    [ErrorsErrorCode.OperationInvalid]: "invalid",
    [ErrorsErrorCode.RouteNotFound]: "not-found",
}

/** The one error class of the errors capability. */
export class ErrorsError extends DomainError<ErrorsErrorCode> {}
