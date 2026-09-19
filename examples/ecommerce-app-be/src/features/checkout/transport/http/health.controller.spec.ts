import {
    Test 
} from "@nestjs/testing"
import {
    HttpException, HttpStatus 
} from "@nestjs/common"
import {
    PostgresPrimaryClient 
} from "@modules/platform/databases/postgresql/order/primary.client"
import {
    IdentityApiClient 
} from "@modules/integrations/identity/identity.client"
import {
    HealthController 
} from "./health.controller"

describe("HealthController - dependency-gated liveness",
    () => {
        const postgres = {
            ping: jest.fn() 
        }
        const identityApi = {
            isHealthy: jest.fn() 
        }
        let controller: HealthController

        beforeEach(async () => {
            jest.clearAllMocks()
            const moduleRef = await Test.createTestingModule({
                providers: [
                    HealthController,
                    {
                        provide: PostgresPrimaryClient, useValue: postgres 
                    },
                    {
                        provide: IdentityApiClient, useValue: identityApi 
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
            })

        it("postgres down answers 503 DEPENDENCY_UNAVAILABLE naming postgres",
            async () => {
                postgres.ping.mockRejectedValue(new Error("connection refused"))
                identityApi.isHealthy.mockResolvedValue(true)
                try {
                    await controller.check()
                    throw new Error("the call should have failed")
                } catch (error) {
                    expect(error).toBeInstanceOf(HttpException)
                    expect((error as HttpException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE)
                    expect((error as HttpException).getResponse()).toMatchObject({
                        code: "DEPENDENCY_UNAVAILABLE" 
                    })
                }
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
