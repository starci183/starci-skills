import { randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common"
import type { Observable } from "rxjs"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { requestOf } from "@modules/platform/http-security"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectMetrics } from "./observability.decorators"
import { ObservabilityLogEvent } from "./observability.log-events"
import type { MetricsRegistryService } from "./metrics-registry.service"

const REQUEST_ID_HEADER = "x-request-id"
const GRAPHQL_ROUTE = "/graphql"
const UNMATCHED_ROUTE = "unmatched"

@Injectable()
/**
 * Gives every request a correlation id (an inbound `x-request-id` is honoured, otherwise a uuid is minted and echoed),
 * records one metric under the matched route template, and writes one access line when the response finished. The line
 * carries the id, method, route, status and duration and nothing else: no headers, no body, no query string.
 */
export class ObservabilityInterceptor implements NestInterceptor {
    constructor(
        @InjectMetrics() private readonly metrics: MetricsRegistryService,
        @InjectLogger() private readonly logger: Logger,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Starts the observation and lets the call through. */
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const request = requestOf(context)
        const response = request.res
        const inbound = request.headers[REQUEST_ID_HEADER]
        const requestId = (Array.isArray(inbound) ? inbound[0] : inbound) || randomUUID()
        const route =
            context.getType<string>() === "graphql"
                ? GRAPHQL_ROUTE
                : typeof request.route?.path === "string"
                  ? `${request.baseUrl}${request.route.path}`
                  : UNMATCHED_ROUTE
        const startedAt = this.clock.now().getTime()
        if (response) {
            response.setHeader(REQUEST_ID_HEADER, requestId)
            response.on("finish", () => {
                const durationMs = this.clock.now().getTime() - startedAt
                this.metrics.recordRequest(request.method, route, response.statusCode, durationMs)
                this.logger.info(ObservabilityLogEvent.RequestCompleted, {
                    requestId,
                    method: request.method,
                    route,
                    status: response.statusCode,
                    durationMs,
                })
            })
        }
        return next.handle()
    }
}
