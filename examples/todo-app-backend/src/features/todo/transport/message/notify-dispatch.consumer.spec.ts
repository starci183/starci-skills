import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import type { Inbox } from "@modules/platform/inbox"
import { DispatchNotificationGroupCommand } from "../../application/dispatch-notification-group.command"
import { NotifyDispatchConsumer } from "./notify-dispatch.consumer"

const message = { id: "row-1", eventId: "notify-flush:w1", attempt: 1, payload: { kind: "flush" as const, groupId: "w1" } }

const build = (claimed: boolean, execute: jest.Mock = jest.fn().mockResolvedValue({ delivered: 1 })) => {
    const inbox = mock<Inbox>({ claim: jest.fn().mockResolvedValue(claimed) })
    const commandBus = mock<CommandBus>({ execute })
    return { consumer: new NotifyDispatchConsumer(inbox, commandBus), inbox, commandBus }
}

describe("NotifyDispatchConsumer", () => {
    it("reads the dispatch queue", () => {
        expect(build(true).consumer.queue.name).toBe("notify.dispatch")
    })

    it("claims the message by its id and dispatches one command for the group", async () => {
        const { consumer, inbox, commandBus } = build(true)
        await consumer.handle(message)
        expect(inbox.claim).toHaveBeenCalledWith("notify.dispatch", "notify-flush:w1")
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(
            new DispatchNotificationGroupCommand({ request: { kind: "flush", groupId: "w1" } }),
        )
    })

    it("does nothing when the message was already claimed", async () => {
        const { consumer, commandBus, inbox } = build(false)
        await consumer.handle(message)
        expect(commandBus.execute).not.toHaveBeenCalled()
        expect(inbox.release).not.toHaveBeenCalled()
    })

    it("gives the claim back and rethrows when the dispatch fails, so the redelivery is processed", async () => {
        const failure = new TypeError("mail host is down")
        const { consumer, inbox } = build(true, jest.fn().mockRejectedValue(failure))
        await expect(consumer.handle(message)).rejects.toBe(failure)
        expect(inbox.release).toHaveBeenCalledWith("notify.dispatch", "notify-flush:w1")
    })
})
