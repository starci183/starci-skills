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
 * Maps the house exception vocabulary onto HTTP statuses for the probe doors, the same way
 * upload-exception.filter.ts maps them for the upload door. A failed readiness dependency surfaces
 * as 503 - the one answer an orchestrator's probe semantics require - and any code this table does
 * not name answers 500: a refusal the probes never declared is an incident, not a status.
 */
const STATUS_BY_CODE: Record<string, number> = {
    POSTGRES_PRIMARY_UNAVAILABLE_EXCEPTION: HttpStatus.SERVICE_UNAVAILABLE,
}

@Catch(AbstractException)
/** ExceptionFilter for the probe HTTP doors: AbstractException code -> status -> {statusCode, code, message}. */
export class ProbesExceptionFilter implements ExceptionFilter {
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
