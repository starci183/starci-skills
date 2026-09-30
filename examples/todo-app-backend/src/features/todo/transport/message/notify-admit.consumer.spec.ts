import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import type { Inbox } from "@modules/platform/inbox"
import { AdmitNotificationCommand } from "../../application/admit-notification.command"
import { NotifyAdmitConsumer } from "./notify-admit.consumer"

const message = {
    id: "row-1",
    eventId: "evt-1",
    attempt: 1,
    payload: {
        kind: "task-complete",
        recipientId: "owner-1",
        channel: "email",
        payload: { taskId: "t1" },
        at: "2026-09-30T10:00:00.000Z",
    },
}

const build = (claimed: boolean, execute: jest.Mock = jest.fn().mockResolvedValue({ kind: "ok" })) => {
    const inbox = mock<Inbox>({ claim: jest.fn().mockResolvedValue(claimed) })
    const commandBus = mock<CommandBus>({ execute })
    return { consumer: new NotifyAdmitConsumer(inbox, commandBus), inbox, commandBus }
}

describe("NotifyAdmitConsumer", () => {
    it("reads the admit queue", () => {
        expect(build(true).consumer.queue.name).toBe("notify.admit")
    })

    it("claims the event by its id and dispatches one admit command with the message id as source event id", async () => {
        const { consumer, inbox, commandBus } = build(true)
        await consumer.handle(message)
        expect(inbox.claim).toHaveBeenCalledWith("notify.admit", "evt-1")
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(
            new AdmitNotificationCommand({
                request: {
                    sourceEventId: "evt-1",
                    kind: "task-complete",
                    recipientId: "owner-1",
                    channel: "email",
                    payload: { taskId: "t1" },
                },
            }),
        )
    })

    it("does nothing when the event was already claimed", async () => {
        const { consumer, commandBus, inbox } = build(false)
        await consumer.handle(message)
        expect(commandBus.execute).not.toHaveBeenCalled()
        expect(inbox.release).not.toHaveBeenCalled()
    })

    it("gives the claim back and rethrows when the dispatch fails, so the redelivery is processed", async () => {
        const failure = new TypeError("database is down")
        const { consumer, inbox } = build(true, jest.fn().mockRejectedValue(failure))
        await expect(consumer.handle(message)).rejects.toBe(failure)
        expect(inbox.release).toHaveBeenCalledWith("notify.admit", "evt-1")
    })
})
