import {
    Injectable, NestMiddleware 
} from "@nestjs/common"
import {
    randomUUID 
} from "node:crypto"
import type {
    NextFunction, Request, Response 
} from "express"
import {
    LogEvent 
} from "@modules/platform/logging/log-events"
import {
    WinstonService 
} from "@modules/platform/logging/winston.service"
import {
    MetricsService 
} from "./metrics.service"
import {
    REQUEST_ID_HEADER, runWithRequestContext 
} from "./request-context"

/**
 * The request-scoped observability seam, applied to every route (`forRoutes("*")` in the module's
 * configure). Three jobs, in order:
 *
 *  1. Correlation: an inbound `x-request-id` is honoured (proxy/upstream correlation), otherwise a
 *     fresh uuid is minted; the id is echoed on the response header and parked on AsyncLocalStorage
 *     so any later code can join the same request's lines.
 *  2. Metrics: on response finish, one counter/summary observation lands in MetricsService under the
 *     matched route template - `req.route.path` collapses `/uploads/abc/content` to
 *     `/uploads/:uploadId/content`, which is what keeps the label set bounded.
 *  3. Access log: one structured `http.request.completed` line per request through the house
 *     WinstonService. The line carries requestId, method, route, status and durationMs - and nothing
 *     else: no headers (Authorization would leak the session token), no body, no query string
 *     (tokens can ride query params), so the line can never carry a secret by construction.
 */
@Injectable()
/** Express middleware minting request-id context, then observing each finished response into metrics and the access log. */
export class ObservabilityMiddleware implements NestMiddleware {
    constructor(
    private readonly metrics: MetricsService,
    private readonly winston: WinstonService,
    ) {}

    use(req: Request, res: Response, next: NextFunction): void {
        const inbound = req.headers[REQUEST_ID_HEADER]
        const requestId = (Array.isArray(inbound) ? inbound[0] : inbound) || randomUUID()
        res.setHeader(REQUEST_ID_HEADER,
            requestId)
        const startedAt = Date.now()
        res.on("finish",
            () => {
                const route = routeLabel(req)
                const durationMs = Date.now() - startedAt
                this.metrics.recordRequest(req.method,
                    route,
                    res.statusCode,
                    durationMs)
                this.winston.log(LogEvent.HTTP_REQUEST_COMPLETED,
                    {
                        requestId,
                        method: req.method,
                        route,
                        status: res.statusCode,
                        durationMs,
                    })
            })
        runWithRequestContext({
            requestId 
        },
        () => next())
    }
}

/** The matched route template for the metrics/log label; requests that matched no route (404s)
 * collapse to "unmatched" so their paths can never become unbounded label values. */
function routeLabel(req: Request): string {
    const route = req.route?.path
    if (typeof route === "string") return `${req.baseUrl}${route}`
    return "unmatched"
}
