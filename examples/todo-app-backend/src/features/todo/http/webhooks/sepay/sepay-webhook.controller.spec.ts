import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    AppConfigService 
} from "@modules/platform/config/app-config.service"
import {
    SepayClient 
} from "@modules/integrations/sepay/sepay.client"
import {
    ConfirmPaymentCommand 
} from "@modules/bussiness/plan/confirm-payment.command"
import {
    SepayWebhookController 
} from "./sepay-webhook.controller"

/** The webhook door over sepay.client + ConfirmPaymentCommand: an unauthorized post is ignored, an
 * authorized one becomes exactly one command, and a non-auth client failure still propagates. */
describe("SepayWebhookController",
    () => {
        let moduleRef: TestingModule
        let controller: SepayWebhookController
        const execute = jest.fn()

        beforeEach(async () => {
            execute.mockReset()
            moduleRef = await Test.createTestingModule({
                providers: [
                    SepayWebhookController,
                    SepayClient,
                    {
                        provide: AppConfigService,
                        useValue: {
                            getSepayWebhookSecret: () => "hook-secret",
                        },
                    },
                    {
                        provide: CommandBus, useValue: {
                            execute 
                        } 
                    },
                ],
            }).compile()
            controller = moduleRef.get(SepayWebhookController)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("fr.plan.upgrade's exception flow: a bad signature is ignored, and no command ever runs",
            async () => {
                const result = await controller.handle("Bearer wrong",
                    {
                        id: "intent-1", status: "paid" 
                    })

                expect(result).toEqual({
                    ignored: true 
                })
                expect(execute).not.toHaveBeenCalled()
            })

        it("a missing Authorization header is ignored the same way",
            async () => {
                const result = await controller.handle(undefined,
                    {
                        id: "intent-1", status: "paid" 
                    })

                expect(result).toEqual({
                    ignored: true 
                })
                expect(execute).not.toHaveBeenCalled()
            })

        it("an authorized 'paid' post runs one ConfirmPaymentCommand with the parsed periodEnd",
            async () => {
                execute.mockResolvedValue({
                    intentId: "intent-1", applied: true 
                })

                const result = await controller.handle("Bearer hook-secret",
                    {
                        id: "intent-1", status: "paid", periodEnd: "2026-10-01T00:00:00.000Z" 
                    })

                expect(execute).toHaveBeenCalledTimes(1)
                const command = execute.mock.calls[0][0] as ConfirmPaymentCommand
                expect(command).toBeInstanceOf(ConfirmPaymentCommand)
                expect(command.params.gatewayIntentId).toBe("intent-1")
                expect(command.params.outcome).toBe("paid")
                expect(command.params.periodEnd).toEqual(new Date("2026-10-01T00:00:00.000Z"))
                expect(result).toEqual({
                    intentId: "intent-1", applied: true 
                })
            })

        it("an authorized 'failed' post without periodEnd forwards outcome and an absent periodEnd",
            async () => {
                execute.mockResolvedValue({
                    intentId: "intent-2", applied: false 
                })

                await controller.handle("Bearer hook-secret",
                    {
                        id: "intent-2", status: "failed" 
                    })

                const command = execute.mock.calls[0][0] as ConfirmPaymentCommand
                expect(command.params.outcome).toBe("failed")
                expect(command.params.periodEnd).toBeUndefined()
            })

        it("a non-auth failure from the client is not swallowed into 'ignored'",
            async () => {
                jest.spyOn(SepayClient.prototype,
                    "assertWebhookAuthorized").mockImplementation(() => {
                        throw new Error("config store exploded")
                    })

                await expect(controller.handle("Bearer hook-secret",
                    {
                        id: "intent-1", status: "paid" 
                    })).rejects.toThrow("config store exploded")
                expect(execute).not.toHaveBeenCalled()
            })
    })
