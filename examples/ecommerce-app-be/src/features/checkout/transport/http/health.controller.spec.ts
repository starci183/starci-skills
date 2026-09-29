import {
    HttpStatus 
} from "@nestjs/common"
import {
    Test 
} from "@nestjs/testing"
import {
    mock 
} from "@starci/jest-preset/mock"
import {
    IdentityApiClient 
} from "@modules/integrations/identity/index"
import {
    OrderPostgresPrimaryClient 
} from "@modules/platform/databases/index"
import {
    LogId, Logger 
} from "@modules/platform/logging/index"
import {
    HealthController 
} from "./health.controller"

describe("HealthController - dependency-gated liveness",
    () => {
        const postgres = mock<OrderPostgresPrimaryClient>()
        const identityApi = mock<IdentityApiClient>()
        const logger = mock<Logger>()
        let controller: HealthController

        beforeEach(async () => {
            jest.clearAllMocks()
            const moduleRef = await Test.createTestingModule({
                providers: [
                    HealthController,
                    {
                        provide: OrderPostgresPrimaryClient, useValue: postgres 
                    },
                    {
                        provide: IdentityApiClient, useValue: identityApi 
                    },
                    {
                        provide: Logger, useValue: logger 
                    },
                ],
            }).compile()
            controller = moduleRef.get(HealthController)
        })

        it("answers ok only when postgres and identity both answer",
            async () => {
                postgres.ping.mockResolvedValue(undefined)
                identityApi.isHealthy.mockResolvedValue(true)

                expect(await controller.check()).toEqual({
                    status: "ok",
                    service: "order",
                    checks: {
                        postgres: "ok", identity: "ok" 
                    },
                })
                expect(logger.warn).not.toHaveBeenCalled()
            })

        it("postgres down answers 503 DEPENDENCY_UNAVAILABLE naming postgres, and logs the probe failure",
            async () => {
                postgres.ping.mockRejectedValue(new Error("connection refused"))
                identityApi.isHealthy.mockResolvedValue(true)

                await expect(controller.check()).rejects.toMatchObject({
                    status: HttpStatus.SERVICE_UNAVAILABLE,
                    response: expect.objectContaining({
                        code: "DEPENDENCY_UNAVAILABLE", message: expect.stringContaining("\"postgres\":\"unreachable\"") 
                    }),
                })
                expect(logger.warn).toHaveBeenCalledWith(LogId.DependencyProbeFailed,
                    {
                        dependency: "postgres", message: "connection refused" 
                    })
            })

        it("identity unreachable answers 503 DEPENDENCY_UNAVAILABLE even when postgres is fine",
            async () => {
                postgres.ping.mockResolvedValue(undefined)
                identityApi.isHealthy.mockResolvedValue(false)

                await expect(controller.check()).rejects.toMatchObject({
                    status: HttpStatus.SERVICE_UNAVAILABLE,
                    response: expect.objectContaining({
                        code: "DEPENDENCY_UNAVAILABLE" 
                    }),
                })
            })
    })
