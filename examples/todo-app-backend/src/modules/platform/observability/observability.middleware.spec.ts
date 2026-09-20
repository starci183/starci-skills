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
    LogEvent 
} from "@modules/platform/logging/log-events"
import {
    WinstonService 
} from "@modules/platform/logging/winston.service"
import {
    MetricsService 
} from "./metrics.service"
import {
    ObservabilityMiddleware 
} from "./observability.middleware"
import {
    currentRequestId, REQUEST_ID_HEADER 
} from "./request-context"

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
            const res = emitter as unknown as Response & EventEmitter & { headers: Record<string, string>; statusCode: number }
            res.headers = {
            }
            res.statusCode = 200
            const mutable = res as unknown as {
                setHeader: unknown 
            }
            mutable.setHeader = (name: string, value: unknown) => {
                res.headers[name.toLowerCase()] = String(value)
            }
            return res
        }

        const run = (req: Partial<Request>, res: ReturnType<typeof makeRes>) =>
            new Promise<void>((resolve) => {
                middleware.use(req as Request,
                    res,
                    (() => resolve()) as NextFunction)
            })

        beforeEach(async () => {
            logged.length = 0
            moduleRef = await Test.createTestingModule({
                providers: [MetricsService,
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
                const res = makeRes()
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
                expect(res.headers[REQUEST_ID_HEADER]).toBe("req-abc")
                expect(seenInside).toBe("req-abc")
                expect(currentRequestId()).toBeUndefined()
            })

        it("mints a request id when the inbound header is absent",
            async () => {
                const res = makeRes()
                const req: Partial<Request> = {
                    headers: {
                    }, method: "GET", baseUrl: "", 
                }
                await run(req,
                    res)
                expect(res.headers[REQUEST_ID_HEADER]).toMatch(/^[0-9a-f-]{36}$/)
            })

        it("on finish records the request under its route template and logs one access line",
            async () => {
                const res = makeRes()
                res.statusCode = 201
                const req = {
                    headers: {
                        [REQUEST_ID_HEADER]: "req-1" 
                    },
                    method: "PUT",
                    baseUrl: "",
                    route: {
                        path: "/uploads/:uploadId/content" 
                    },
                } as unknown as Request
                await run(req,
                    res)
                res.emit("finish")

                const text = metrics.renderPrometheus()
                expect(text).toContain("http_requests_total{method=\"PUT\",route=\"/uploads/:uploadId/content\",status=\"201\"} 1")
                expect(logged).toHaveLength(1)
                expect(logged[0].event).toBe(LogEvent.HTTP_REQUEST_COMPLETED)
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
                const res = makeRes()
                res.statusCode = 404
                const req = {
                    headers: {
                    }, method: "GET", baseUrl: "", 
                } as unknown as Request
                await run(req,
                    res)
                res.emit("finish")
                expect(metrics.renderPrometheus()).toContain("route=\"unmatched\"")
            })
    })
