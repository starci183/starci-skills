import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    HttpException, HttpStatus 
} from "@nestjs/common"
import {
    PostgresPrimaryClient 
} from "@modules/platform/databases/postgresql/primary/primary.client"
import {
    HealthController 
} from "./health.controller"

/** GET /health: 200 while the primary database answers ping, 503 with the named refusal when it does not. */
describe("HealthController",
    () => {
        let moduleRef: TestingModule
        let controller: HealthController
        const ping = jest.fn()

        beforeEach(async () => {
            ping.mockReset()
            moduleRef = await Test.createTestingModule({
                providers: [
                    HealthController,
                    {
                        provide: PostgresPrimaryClient, useValue: {
                            ping 
                        } 
                    },
                ],
            }).compile()
            controller = moduleRef.get(HealthController)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("reports ok while the database answers",
            async () => {
                ping.mockResolvedValue(undefined)
                await expect(controller.check()).resolves.toEqual({
                    status: "ok" 
                })
            })

        it("turns a failed ping into a 503, never a bare 500 or a swallowed ok",
            async () => {
                ping.mockRejectedValue(new Error("connection refused"))
                await expect(controller.check()).rejects.toMatchObject({
                    status: HttpStatus.SERVICE_UNAVAILABLE,
                })
                await expect(controller.check()).rejects.toBeInstanceOf(HttpException)
            })
    })
