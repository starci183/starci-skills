import "reflect-metadata"
import {
    HttpException 
} from "@nestjs/common"
import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    PostgresPrimaryClient 
} from "@modules/platform/databases/postgresql/identity/primary.client"
import {
    RedisPrimaryClient 
} from "@modules/platform/caches/redis/primary/redis.client"
import {
    HealthController 
} from "./health.controller"

/** /health answers ok only when both dependencies answer, and names the one that refused. */
describe("HealthController - infrastructure probe door",
    () => {
        let controller: HealthController
        let postgres: { ping: jest.Mock }
        let redis: { ping: jest.Mock }

        beforeEach(async () => {
            postgres = {
                ping: jest.fn().mockResolvedValue(undefined) 
            }
            redis = {
                ping: jest.fn().mockResolvedValue(undefined) 
            }
            const module: TestingModule = await Test.createTestingModule({
                controllers: [HealthController],
                providers: [
                    {
                        provide: PostgresPrimaryClient, useValue: postgres 
                    },
                    {
                        provide: RedisPrimaryClient, useValue: redis 
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
            })

        it("answers 503 DEPENDENCY_UNAVAILABLE naming postgres when postgres refuses",
            async () => {
                postgres.ping.mockRejectedValue(new Error("connection refused"))
                try {
                    await controller.check()
                    throw new Error("the check should have been refused")
                } catch (error) {
                    expect(error).toBeInstanceOf(HttpException)
                    const http = error as HttpException
                    expect(http.getStatus()).toBe(503)
                    const body = http.getResponse() as { code: string; message: string }
                    expect(body.code).toBe("DEPENDENCY_UNAVAILABLE")
                    expect(body.message).toContain("\"postgres\":\"unreachable\"")
                    expect(body.message).toContain("\"redis\":\"ok\"")
                }
            })

        it("answers 503 DEPENDENCY_UNAVAILABLE naming redis when redis refuses",
            async () => {
                redis.ping.mockRejectedValue(new Error("Redis connection is end."))
                try {
                    await controller.check()
                    throw new Error("the check should have been refused")
                } catch (error) {
                    expect(error).toBeInstanceOf(HttpException)
                    const http = error as HttpException
                    expect(http.getStatus()).toBe(503)
                    const body = http.getResponse() as { code: string; message: string }
                    expect(body.code).toBe("DEPENDENCY_UNAVAILABLE")
                    expect(body.message).toContain("\"redis\":\"unreachable\"")
                    expect(body.message).toContain("\"postgres\":\"ok\"")
                }
            })

        it("names both dependencies when both refuse - it still checks redis after postgres fails",
            async () => {
                postgres.ping.mockRejectedValue(new Error("connection refused"))
                redis.ping.mockRejectedValue(new Error("Redis connection is end."))
                try {
                    await controller.check()
                    throw new Error("the check should have been refused")
                } catch (error) {
                    expect(error).toBeInstanceOf(HttpException)
                    const body = (error as HttpException).getResponse() as { code: string; message: string }
                    expect(body.code).toBe("DEPENDENCY_UNAVAILABLE")
                    expect(body.message).toContain("\"postgres\":\"unreachable\"")
                    expect(body.message).toContain("\"redis\":\"unreachable\"")
                }
                expect(redis.ping).toHaveBeenCalled()
            })
    })
