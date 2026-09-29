import {
    Test, TestingModule 
} from "@nestjs/testing"
import type {
    NextFunction, Request, Response 
} from "express"
import {
    EventEmitter 
} from "node:events"
import {
    LogEvent,
} from "@modules/platform/logging/index"
import {
    WinstonService,
} from "@modules/platform/logging/index"
import {
    MetricsService 
} from "./metrics.service"
import {
    ObservabilityMiddleware 
} from "./observability.middleware"
import {
    currentRequestId, REQUEST_ID_HEADER 
} from "./request-context"
import {
    Clock 
} from "@modules/platform/clock/index"
import {
    FakeClock 
} from "@starci/jest-preset/clock"
import {
    mock 
} from "@starci/jest-preset/mock"

/**
 * The middleware's contract: a presented x-request-id is honoured and echoed; an absent one is minted;
 * the id is visible to downstream code through the AsyncLocalStorage context; and response finish
 * records the request into MetricsService and writes one structured access line that carries the id,
 * the route template and no headers.
 */
describe("observability middleware",
    () => {
        let moduleRef: TestingModule
        let middleware: ObservabilityMiddleware
        let metrics: MetricsService
        const logged: Array<{ event: LogEvent; data: Record<string, unknown> }> = []

        const makeRes = () => {
            const emitter = new EventEmitter()
            const headers: Record<string, string> = {
            }
            const res: Response = mock<Response>({
                statusCode: 200,
                setHeader: (name: string, value: number | string | ReadonlyArray<string>) => {
                    headers[name.toLowerCase()] = String(value)
                    return res
                },
                on: emitter.on.bind(emitter) as Response["on"],
            })
            return {
                res, headers, finish: () => emitter.emit("finish")
            }
        }

        const run = (req: Partial<Request>, res: Response) =>
            new Promise<void>((resolve) => {
                middleware.use(req as Request,
                    res,
                    (() => resolve()) as NextFunction)
            })

        beforeEach(async () => {
            logged.length = 0
            moduleRef = await Test.createTestingModule({
                providers: [
                    {
                        provide: Clock, useValue: new FakeClock() 
                    },
                    MetricsService,
                    ObservabilityMiddleware,
                    {
                        provide: WinstonService,
                        useValue: {
                            log: (event: LogEvent, data: Record<string, unknown>) => logged.push({
                                event, data 
                            }) 
                        },
                    }],
            }).compile()
            middleware = moduleRef.get(ObservabilityMiddleware)
            metrics = moduleRef.get(MetricsService)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("echoes an inbound x-request-id and exposes it through the request context",
            async () => {
                const { res, headers } = makeRes()
                const req: Partial<Request> = {
                    headers: {
                        [REQUEST_ID_HEADER]: "req-abc" 
                    }, method: "GET", baseUrl: "", 
                }
                let seenInside: string | undefined
                await run(req,
                    res)
                // The context only lives during next(); read it inside a nested run.
                await new Promise<void>((resolve) => {
                    middleware.use(req as Request,
                        res,
                        (() => {
                            seenInside = currentRequestId()
                            resolve()
                        }) as NextFunction)
                })
                expect(headers[REQUEST_ID_HEADER]).toBe("req-abc")
                expect(seenInside).toBe("req-abc")
                expect(currentRequestId()).toBeUndefined()
            })

        it("mints a request id when the inbound header is absent",
            async () => {
                const { res, headers } = makeRes()
                const req: Partial<Request> = {
                    headers: {
                    }, method: "GET", baseUrl: "", 
                }
                await run(req,
                    res)
                expect(headers[REQUEST_ID_HEADER]).toMatch(/^[0-9a-f-]{36}$/)
            })

        it("on finish records the request under its route template and logs one access line",
            async () => {
                const { res, finish } = makeRes()
                res.statusCode = 201
                const req = mock<Request>({
                    headers: {
                        [REQUEST_ID_HEADER]: "req-1" 
                    },
                    method: "PUT",
                    baseUrl: "",
                    route: {
                        path: "/uploads/:uploadId/content" 
                    },
                })
                await run(req,
                    res)
                finish()

                const text = metrics.renderPrometheus()
                expect(text).toContain("http_requests_total{method=\"PUT\",route=\"/uploads/:uploadId/content\",status=\"201\"} 1")
                expect(logged).toHaveLength(1)
                expect(logged[0].event).toBe(LogEvent.HttpRequestCompleted)
                expect(logged[0].data).toMatchObject({
                    requestId: "req-1",
                    method: "PUT",
                    route: "/uploads/:uploadId/content",
                    status: 201,
                })
                expect(logged[0].data.durationMs).toEqual(expect.any(Number))
            })

        it("collapses requests that matched no route to the bounded 'unmatched' label",
            async () => {
                const { res, finish } = makeRes()
                res.statusCode = 404
                const req = mock<Request>({
                    headers: {
                    }, method: "GET", baseUrl: "", 
                })
                await run(req,
                    res)
                finish()
                expect(metrics.renderPrometheus()).toContain("route=\"unmatched\"")
            })
    })
