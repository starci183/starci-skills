import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { AUDIT_APPEND_QUEUE, AuditAction } from "@modules/domain/audit"
import type { AuditAppendPayload } from "@modules/domain/audit"
import type { Inbox } from "@modules/platform/inbox"
import type { ConsumedMessage } from "@modules/platform/messaging"
import { AppendLogLineCommand } from "../../application/append-log-line.command"
import { AuditAppendConsumer } from "./audit-append.consumer"

const AT_ISO = "2026-09-30T10:00:00.000Z"
const message: ConsumedMessage<AuditAppendPayload> = {
    id: "row-1",
    eventId: "e1",
    attempt: 1,
    payload: { actorId: "p1", action: AuditAction.TaskCompleted, target: "t1", at: AT_ISO },
}

describe("AuditAppendConsumer", () => {
    it("reads the audit append queue", () => {
        const consumer = new AuditAppendConsumer(mock<Inbox>(), mock<CommandBus>())
        expect(consumer.queue).toBe(AUDIT_APPEND_QUEUE)
    })

    it("claims the event before anything else, then dispatches exactly one append command with the instant of the action", async () => {
        const order: Array<string> = []
        const inbox = mock<Inbox>({
            claim: jest.fn().mockImplementation(() => {
                order.push("claim")
                return Promise.resolve(true)
            }),
        })
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockImplementation(() => {
                order.push("execute")
                return Promise.resolve({ lineId: "1" })
            }),
        })
        await new AuditAppendConsumer(inbox, commandBus).handle(message)
        expect(order).toEqual(["claim", "execute"])
        expect(inbox.claim).toHaveBeenCalledWith("audit.append", "e1")
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(
            new AppendLogLineCommand({
                request: { actorId: "p1", action: AuditAction.TaskCompleted, target: "t1", at: new Date(AT_ISO) },
            }),
        )
        expect(inbox.release).not.toHaveBeenCalled()
    })

    it("does nothing when the event was already claimed", async () => {
        const inbox = mock<Inbox>({ claim: jest.fn().mockResolvedValue(false) })
        const commandBus = mock<CommandBus>()
        await new AuditAppendConsumer(inbox, commandBus).handle(message)
        expect(commandBus.execute).not.toHaveBeenCalled()
        expect(inbox.release).not.toHaveBeenCalled()
    })

    it("releases the claim and rethrows when the append fails, so the redelivery is processed", async () => {
        const inbox = mock<Inbox>({ claim: jest.fn().mockResolvedValue(true), release: jest.fn().mockResolvedValue(undefined) })
        const failure = new Error("database down")
        const commandBus = mock<CommandBus>({ execute: jest.fn().mockRejectedValue(failure) })
        await expect(new AuditAppendConsumer(inbox, commandBus).handle(message)).rejects.toBe(failure)
        expect(inbox.release).toHaveBeenCalledWith("audit.append", "e1")
    })
})
