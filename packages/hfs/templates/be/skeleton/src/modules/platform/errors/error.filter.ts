import { Catch, HttpException, HttpStatus } from "@nestjs/common"
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common"
import type { Response } from "express"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ErrorsLogEvent } from "./errors.log-events"

@Catch()
/** The one filter of an app: logs every failure once and answers with a status and a code that reveal nothing else. */
export class ErrorFilter implements ExceptionFilter {
    constructor(@InjectLogger() private readonly logger: Logger) {}

    /** Answers the request; an unknown failure is a 500 whose body names no detail. */
    catch(exception: unknown, host: ArgumentsHost): void {
        const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR
        this.logger.error(ErrorsLogEvent.RequestFailed, exception, { status })
        const code = status === HttpStatus.INTERNAL_SERVER_ERROR ? "internal_error" : `http_${status}`
        host.switchToHttp().getResponse<Response>().status(status).json({ code })
    }
}
