import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common"
import type { Response } from "express"
import { Logger, LogId } from "@modules/platform/logging"
import { DomainError } from "./domain-error"

/** What a log line says about a failure: its name and code, never the stack or the request. */
const describeFailure = (exception: unknown): Readonly<Record<string, unknown>> =>
    exception instanceof DomainError
        ? { name: exception.name, code: exception.code }
        : { name: exception instanceof Error ? exception.name : typeof exception }

/** The one filter of an app: logs every failure once and answers with a status and a code that reveal nothing else. */
@Catch()
export class ErrorFilter implements ExceptionFilter {
    constructor(private readonly logger: Logger) {}

    /** Answers the request; an unknown failure is a 500 whose body names no detail. */
    catch(exception: unknown, host: ArgumentsHost): void {
        const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR
        this.logger.error(LogId.RequestFailed, { status, failure: describeFailure(exception) })
        const code = status === HttpStatus.INTERNAL_SERVER_ERROR ? "internal_error" : `http_${status}`
        host.switchToHttp().getResponse<Response>().status(status).json({ code })
    }
}
