import type { CallHandler, ExecutionContext } from "@nestjs/common"
import type { HttpArgumentsHost } from "@nestjs/common/interfaces"
import type { Request, Response } from "express"
import { of } from "rxjs"
import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import type { Logger } from "@modules/platform/logging"
import { ObservabilityInterceptor } from "./observability.interceptor"
import { ObservabilityLogEvent } from "./observability.log-events"
import type { Metrics } from "./observability.port"

const AT = new Date("2026-09-30T10:00:00.000Z")
const handler: CallHandler = { handle: () => of("done") }

interface Rig {
    readonly interceptor: ObservabilityInterceptor
    readonly metrics: Metrics
    readonly logger: Logger
    readonly context: ExecutionContext
    readonly response: Response
    readonly clock: FakeClock
    readonly finished: Array<() => void>
}

const build = (headers: Record<string, string>): Rig => {
    const finished: Array<() => void> = []
    const response = mock<Response>({
        statusCode: 200,
        setHeader: jest.fn(),
        on: jest.fn().mockImplementation((_event: string, listener: () => void) => finished.push(listener)),
    })
    const request = mock<Request>({ method: "GET", baseUrl: "", route: { path: "/health" }, headers, res: response })
    const http = mock<HttpArgumentsHost>({ getRequest: jest.fn().mockReturnValue(request) })
    const context = mock<ExecutionContext>({ getType: jest.fn().mockReturnValue("http"), switchToHttp: () => http })
    const clock = new FakeClock(AT)
    const metrics = mock<Metrics>()
    const logger = mock<Logger>()
    return { interceptor: new ObservabilityInterceptor(metrics, logger, clock), metrics, logger, context, response, clock, finished }
}

describe("ObservabilityInterceptor", () => {
    it("honours an inbound request id, echoes it, and records the metric and the access line on finish", () => {
        const { interceptor, metrics, logger, context, response, clock, finished } = build({ "x-request-id": "req-1" })
        interceptor.intercept(context, handler)
        clock.advance(12)
        finished.forEach((listener) => listener())
        expect(response.setHeader).toHaveBeenCalledWith("x-request-id", "req-1")
        expect(metrics.recordRequest).toHaveBeenCalledWith("GET", "/health", 200, 12)
        expect(logger.info).toHaveBeenCalledWith(ObservabilityLogEvent.RequestCompleted, {
            requestId: "req-1",
            method: "GET",
            route: "/health",
            status: 200,
            durationMs: 12,
        })
    })

    it("mints an id when the request carries none", () => {
        const { interceptor, context, response } = build({})
        interceptor.intercept(context, handler)
        expect(response.setHeader).toHaveBeenCalledWith("x-request-id", expect.any(String))
    })
})
