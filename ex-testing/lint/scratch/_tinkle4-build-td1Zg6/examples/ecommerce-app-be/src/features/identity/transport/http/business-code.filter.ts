import {
    ArgumentsHost, Catch, ExceptionFilter 
} from "@nestjs/common"
import type {
    Response 
} from "express"
import {
    AbstractException 
} from "@modules/platform/exceptions/errors/abstract"

@Catch(AbstractException)
/**
 * The REST half of the wire-code contract: a thrown AbstractException answers with its status
 * plus the flat `{code, message, ...metadata}` body it already carries - except `code` goes out
 * stripped of the `_EXCEPTION` transport suffix, the same business code GraphQL's `formatError`
 * stamps on `extensions.code`. Parity between transports is the contract: a refused session is
 * `SESSION_INVALID` on /internal/sessions/verify exactly as it is on /graphql, and the exception
 * class keeps its `*_EXCEPTION` name internally either way.
 */
export class BusinessCodeExceptionFilter implements ExceptionFilter {
    catch(exception: AbstractException, host: ArgumentsHost): void {
        const response = host.switchToHttp().getResponse<Response>()
        const body = exception.getResponse()
        response.status(exception.getStatus()).json(
            typeof body === "object" && body !== null
                ? {
                    ...body, code: exception.code.replace(/_EXCEPTION$/,
                        "") 
                }
                : body,
        )
    }
}
