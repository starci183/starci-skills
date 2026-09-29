import "reflect-metadata"
import {
    HttpStatus 
} from "@nestjs/common"
import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    mock 
} from "@starci/jest-preset/mock"
import {
    RedisPrimaryClient 
} from "@modules/platform/caches/index"
import {
    IdentityPostgresPrimaryClient 
} from "@modules/platform/databases/index"
import {
    LogId, Logger 
} from "@modules/platform/logging/index"
import {
    HealthController 
} from "./health.controller"

/** /health answers ok only when both dependencies answer, and names the one that refused. */
describe("HealthController - infrastructure probe door",
    () => {
        let controller: HealthController
        const postgres = mock<IdentityPostgresPrimaryClient>()
        const redis = mock<RedisPrimaryClient>()
        const logger = mock<Logger>()

        /** The 503 a refused probe answers: the code and the dependency map the message carries. */
        const refusal = (message: string) => ({
            status: HttpStatus.SERVICE_UNAVAILABLE,
            response: expect.objectContaining({
                code: "DEPENDENCY_UNAVAILABLE", message: expect.stringContaining(message) 
            }),
        })

        beforeEach(async () => {
            jest.clearAllMocks()
            postgres.ping.mockResolvedValue(undefined)
            redis.ping.mockResolvedValue(undefined)
            const module: TestingModule = await Test.createTestingModule({
                controllers: [HealthController],
                providers: [
                    {
                        provide: IdentityPostgresPrimaryClient, useValue: postgres 
                    },
                    {
                        provide: RedisPrimaryClient, useValue: redis 
                    },
                    {
                        provide: Logger, useValue: logger 
                    },
                ],
            }).compile()
            controller = module.get(HealthController)
        })

        it("answers ok when postgres and redis both answer",
            async () => {
                await expect(controller.check()).resolves.toEqual({
                    status: "ok",
                    service: "identity",
                    checks: {
                        postgres: "ok", redis: "ok" 
                    },
                })
                expect(logger.warn).not.toHaveBeenCalled()
            })

        it("answers 503 DEPENDENCY_UNAVAILABLE naming postgres when postgres refuses, and logs the probe failure",
            async () => {
                postgres.ping.mockRejectedValue(new Error("connection refused"))

                const outcome = controller.check()

                await expect(outcome).rejects.toMatchObject(refusal("\"postgres\":\"unreachable\""))
                await expect(outcome).rejects.toMatchObject(refusal("\"redis\":\"ok\""))
                expect(logger.warn).toHaveBeenCalledWith(LogId.DependencyProbeFailed,
                    {
                        dependency: "postgres", message: "connection refused" 
                    })
            })

        it("answers 503 DEPENDENCY_UNAVAILABLE naming redis when redis refuses",
            async () => {
                redis.ping.mockRejectedValue(new Error("Redis connection is end."))

                const outcome = controller.check()

                await expect(outcome).rejects.toMatchObject(refusal("\"redis\":\"unreachable\""))
                await expect(outcome).rejects.toMatchObject(refusal("\"postgres\":\"ok\""))
                expect(logger.warn).toHaveBeenCalledWith(LogId.DependencyProbeFailed,
                    {
                        dependency: "redis", message: "Redis connection is end." 
                    })
            })

        it("names both dependencies when both refuse - it still checks redis after postgres fails",
            async () => {
                postgres.ping.mockRejectedValue(new Error("connection refused"))
                redis.ping.mockRejectedValue(new Error("Redis connection is end."))

                const outcome = controller.check()

                await expect(outcome).rejects.toMatchObject(refusal("\"postgres\":\"unreachable\""))
                await expect(outcome).rejects.toMatchObject(refusal("\"redis\":\"unreachable\""))
                expect(redis.ping).toHaveBeenCalled()
                expect(logger.warn).toHaveBeenCalledTimes(2)
            })
    })
