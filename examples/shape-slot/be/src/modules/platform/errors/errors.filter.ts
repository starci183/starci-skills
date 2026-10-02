import { Catch } from "@nestjs/common"
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common"
import type { Request, Response } from "express"
import { InjectRequestLocale } from "@modules/platform/i18n"
import type { RequestLocale } from "@modules/platform/i18n"
import { InjectErrorsService } from "./errors.decorators"
import type { ErrorsService } from "./errors.service"

@Catch()
/** The one exception filter of an app: answers `{ code, kind, message, params }` with the status of the kind. */
export class ErrorsFilter implements ExceptionFilter {
    constructor(
        @InjectErrorsService() private readonly errors: ErrorsService,
        @InjectRequestLocale() private readonly requestLocale: RequestLocale,
    ) {}

    /** Writes the description of `exception` on the HTTP response. */
    catch(exception: unknown, host: ArgumentsHost): void {
        const http = host.switchToHttp()
        const request = http.getRequest<Request>()
        const description = this.errors.describe(exception)
        const locale = this.requestLocale.of(request.headers["accept-language"])
        http.getResponse<Response>()
            .status(description.status)
            .json({
                code: description.code,
                kind: description.kind,
                message: this.errors.text(description.code, description.params, locale),
                params: description.params,
            })
    }
}
