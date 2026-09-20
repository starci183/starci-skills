import {
    ArgumentsHost, Catch, ExceptionFilter, HttpStatus 
} from "@nestjs/common"
import type {
    Response 
} from "express"
import {
    AbstractException 
} from "@modules/shared/exceptions/errors/abstract"

/**
 * Maps the house exception vocabulary onto HTTP statuses for the upload door, the way
 * graphql.module.ts's formatError maps the same exceptions onto `extensions.code` for GraphQL - the
 * wire sees the same stable code minus its `_EXCEPTION` transport suffix in both transports. Any code
 * this table does not name answers 500: a refusal the capability never declared is an incident, not a
 * status.
 */
const STATUS_BY_CODE: Record<string, number> = {
    UPLOAD_NOT_FOUND_EXCEPTION: HttpStatus.NOT_FOUND,
    UPLOAD_FORBIDDEN_EXCEPTION: HttpStatus.FORBIDDEN,
    UPLOAD_TOO_LARGE_EXCEPTION: HttpStatus.PAYLOAD_TOO_LARGE,
    UPLOAD_MIME_NOT_ALLOWED_EXCEPTION: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    UPLOAD_TOKEN_INVALID_EXCEPTION: HttpStatus.FORBIDDEN,
    UPLOAD_NOT_READY_EXCEPTION: HttpStatus.CONFLICT,
    UPLOAD_SCAN_REJECTED_EXCEPTION: HttpStatus.UNPROCESSABLE_ENTITY,
    SESSION_NOT_FOUND_EXCEPTION: HttpStatus.UNAUTHORIZED,
    SESSION_EXPIRED_EXCEPTION: HttpStatus.UNAUTHORIZED,
    TASK_NOT_FOUND_EXCEPTION: HttpStatus.NOT_FOUND,
    TASK_FORBIDDEN_EXCEPTION: HttpStatus.FORBIDDEN,
}

@Catch(AbstractException)
/** ExceptionFilter for the upload HTTP door: AbstractException code -> status -> {statusCode, code, message}. */
export class UploadExceptionFilter implements ExceptionFilter {
    catch(exception: AbstractException, host: ArgumentsHost): void {
        const response = host.switchToHttp().getResponse<Response>()
        const status = STATUS_BY_CODE[exception.code] ?? HttpStatus.INTERNAL_SERVER_ERROR
        response.status(status).json({
            statusCode: status,
            code: exception.code.replace(/_EXCEPTION$/,
                ""),
            message: exception.message,
        })
    }
}
