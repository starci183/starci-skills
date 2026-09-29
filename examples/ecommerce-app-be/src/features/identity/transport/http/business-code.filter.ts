import {
    ArgumentsHost, Catch, ExceptionFilter, HttpStatus 
} from "@nestjs/common"
import type {
    Response 
} from "express"
import {
    DomainError 
} from "ecommerce-app-be/modules/platform/errors"

/**
 * The status each declared code answers on the REST doors: the transport owns this table, the error
 * classes only carry their code. A code the table does not name is an incident, so it answers 500.
 */
const STATUS_BY_CODE: Readonly<Record<string, number>> = {
    SESSION_INVALID_EXCEPTION: HttpStatus.UNAUTHORIZED,
    REQUEST_INVALID_EXCEPTION: HttpStatus.BAD_REQUEST,
    INVALID_CREDENTIALS_EXCEPTION: HttpStatus.UNAUTHORIZED,
    EMAIL_TAKEN_EXCEPTION: HttpStatus.CONFLICT,
    PERSON_UNKNOWN_EXCEPTION: HttpStatus.NOT_FOUND,
}

@Catch(DomainError)
/**
 * The REST half of the wire-code contract: a thrown DomainError answers with the status its code maps
 * to plus the flat `{code, message, ...metadata}` body - except `code` goes out stripped of the
 * `_EXCEPTION` transport suffix, the same business code GraphQL's `formatError` stamps on
 * `extensions.code`. Parity between transports is the contract: a refused session is
 * `SESSION_INVALID` on /internal/sessions/verify exactly as it is on /graphql, and the error
 * class keeps its `*_EXCEPTION` name internally either way.
 */
export class BusinessCodeExceptionFilter implements ExceptionFilter {
    /** Writes the mapped status and the flat business-code body onto the response. */
    catch(exception: DomainError, host: ArgumentsHost): void {
        const response = host.switchToHttp().getResponse<Response>()
        const status = STATUS_BY_CODE[exception.code] ?? HttpStatus.INTERNAL_SERVER_ERROR
        response.status(status).json({
            ...exception.metadata,
            code: exception.code.replace(/_EXCEPTION$/,
                ""),
            message: exception.message,
        })
    }
}
