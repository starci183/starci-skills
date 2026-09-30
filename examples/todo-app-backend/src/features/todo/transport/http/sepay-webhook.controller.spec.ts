import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { PlanError, PlanErrorCode } from "@modules/domain/plan"
import type { SepayOptions } from "@modules/integrations/sepay"
import { Secret } from "@modules/platform/config"
import type { Inbox } from "@modules/platform/inbox"
import { ConfirmPaymentCommand } from "../../application/confirm-payment.command"
import { SepayWebhookController } from "./sepay-webhook.controller"

const options: SepayOptions = {
    baseUrl: "http://sepay.test",
    apiKey: new Secret("api-key"),
    webhookSecret: new Secret("hook-secret"),
    timeoutMs: 250,
}
const AUTHORIZED = "Bearer hook-secret"

/** What `build` wires: the handler and the doubles the specs assert on. */
interface Built {
    controller: SepayWebhookController
    commandBus: CommandBus
    inbox: Inbox
}

const build = (
    execute: jest.Mock = jest.fn().mockResolvedValue({ kind: "ok", value: { applied: true, subscriptionStatus: "active" } }),
    claim: jest.Mock = jest.fn().mockResolvedValue(true),
): Built => {
    const commandBus = mock<CommandBus>({ execute })
    const inbox = mock<Inbox>({ claim, release: jest.fn().mockResolvedValue(undefined) })
    return { controller: new SepayWebhookController(commandBus, inbox, options), commandBus, inbox }
}

describe("SepayWebhookController", () => {
    it("ignores a delivery with a wrong signature: nothing is claimed and no command runs", async () => {
        const { controller, commandBus, inbox } = build()
        await expect(controller.receive("Bearer wrong", { id: "g1", status: "paid" })).resolves.toEqual({ ignored: true })
        expect(inbox.claim).not.toHaveBeenCalled()
        expect(commandBus.execute).not.toHaveBeenCalled()
    })

    it("ignores a delivery without an Authorization header the same way", async () => {
        const { controller, commandBus } = build()
        await expect(controller.receive(undefined, { id: "g1", status: "paid" })).resolves.toEqual({ ignored: true })
        expect(commandBus.execute).not.toHaveBeenCalled()
    })

    it("ignores a replayed delivery: the claim answers false and no command runs", async () => {
        const { controller, commandBus, inbox } = build(undefined, jest.fn().mockResolvedValue(false))
        await expect(controller.receive(AUTHORIZED, { id: "g1", status: "paid" })).resolves.toEqual({ ignored: true })
        expect(inbox.claim).toHaveBeenCalledWith("sepay.webhook", "g1")
        expect(commandBus.execute).not.toHaveBeenCalled()
    })

    it("claims the delivery, then dispatches exactly one confirm command with the parsed period end", async () => {
        const { controller, commandBus, inbox } = build()
        const result = await controller.receive(AUTHORIZED, { id: "g1", status: "paid", periodEnd: "2026-10-01T00:00:00.000Z" })
        expect(result).toEqual({ ignored: false, applied: true, subscriptionStatus: "active" })
        expect(inbox.claim).toHaveBeenCalledWith("sepay.webhook", "g1")
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(
            new ConfirmPaymentCommand({
                request: { gatewayIntentId: "g1", outcome: "paid", periodEnd: new Date("2026-10-01T00:00:00.000Z") },
            }),
        )
        expect(inbox.release).not.toHaveBeenCalled()
    })

    it("forwards a failed delivery without a period end", async () => {
        const { controller, commandBus } = build()
        await controller.receive(AUTHORIZED, { id: "g2", status: "failed" })
        expect(commandBus.execute).toHaveBeenCalledWith(
            new ConfirmPaymentCommand({ request: { gatewayIntentId: "g2", outcome: "failed", periodEnd: undefined } }),
        )
    })

    it("gives the claim back and rethrows the plan error when the intent is unknown, so a redelivery is processed", async () => {
        const execute = jest.fn().mockResolvedValue({ kind: "refused", code: PlanErrorCode.PaymentIntentNotFound })
        const { controller, inbox } = build(execute)
        const call = controller.receive(AUTHORIZED, { id: "nope", status: "paid" })
        await expect(call).rejects.toBeInstanceOf(PlanError)
        expect(inbox.release).toHaveBeenCalledWith("sepay.webhook", "nope")
    })

    it("gives the claim back and rethrows when the dispatch throws", async () => {
        const failure = new Error("database down")
        const { controller, inbox } = build(jest.fn().mockRejectedValue(failure))
        await expect(controller.receive(AUTHORIZED, { id: "g1", status: "paid" })).rejects.toBe(failure)
        expect(inbox.release).toHaveBeenCalledWith("sepay.webhook", "g1")
    })
})
