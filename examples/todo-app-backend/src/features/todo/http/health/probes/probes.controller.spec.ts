import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    PostgresPrimaryClient 
} from "@modules/platform/databases/postgresql/primary/primary.client"
import {
    MetricsService 
} from "@modules/platform/observability/metrics.service"
import {
    PostgresPrimaryUnavailableException 
} from "@modules/shared/exceptions/errors/postgres/postgres-primary-unavailable"
import {
    ProbesController 
} from "./probes.controller"

/**
 * The probe doors' contract: /ready answers ok while postgres answers and refuses with the house
 * postgres-unavailable exception when it does not (the door's filter maps that code to 503 - the same
 * dependency-checked shape /health carries), and /metrics serves the registry's Prometheus text.
 */
describe("probes controller",
    () => {
        let moduleRef: TestingModule
        let controller: ProbesController
        const db = {
            ping: jest.fn(async () => undefined) 
        }

        beforeEach(async () => {
            db.ping.mockClear()
            moduleRef = await Test.createTestingModule({
                providers: [MetricsService,
                    ProbesController,
                    {
                        provide: PostgresPrimaryClient, useValue: db 
                    }],
            }).compile()
            controller = moduleRef.get(ProbesController)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("ready answers ok while the database pings",
            async () => {
                await expect(controller.ready()).resolves.toEqual({
                    status: "ok" 
                })
            })

        it("ready refuses with the postgres-unavailable code when the database cannot be reached",
            async () => {
                db.ping.mockRejectedValueOnce(new Error("connection refused"))
                await expect(controller.ready()).rejects.toBeInstanceOf(PostgresPrimaryUnavailableException)
            })

        it("metrics renders the registry's Prometheus exposition",
            async () => {
                const metrics = moduleRef.get(MetricsService)
                metrics.recordRequest("GET",
                    "/ready",
                    200,
                    2)
                const text = controller.metrics()
                expect(text).toContain("http_requests_total{method=\"GET\",route=\"/ready\",status=\"200\"} 1")
            })
    })
