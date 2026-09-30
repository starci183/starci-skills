import { mock } from "@starci/jest-preset/mock"
import { AuditAction } from "@modules/domain/audit"
import type { AuditLogService } from "@modules/domain/audit"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { AppendLogLineCommand } from "./append-log-line.command"
import { AppendLogLineHandler } from "./append-log-line.handler"

const AT = new Date("2026-09-30T10:00:00.000Z")

describe("AppendLogLineHandler", () => {
    it("appends the line inside one transaction, at the instant the message carries", async () => {
        const inner = mockEntityManager()
        const log = mock<AuditLogService>({ append: jest.fn().mockResolvedValue({ lineId: "42" }) })
        const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
        const handler = new AppendLogLineHandler(mock<Logger>(), entityManager, log)
        const result = await handler.execute(
            new AppendLogLineCommand({
                request: { actorId: "p1", action: AuditAction.TaskCreated, target: "t1", at: AT },
            }),
        )
        expect(result).toEqual({ lineId: "42" })
        expect(entityManager.transaction).toHaveBeenCalledTimes(1)
        expect(log.append).toHaveBeenCalledWith({
            manager: inner,
            actorId: "p1",
            action: "task.created",
            target: "t1",
            at: AT,
        })
    })

    it("lets a failed append fail the command so the queue redelivers", async () => {
        const inner = mockEntityManager()
        const log = mock<AuditLogService>({ append: jest.fn().mockRejectedValue(new Error("chain lock lost")) })
        const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
        const handler = new AppendLogLineHandler(mock<Logger>(), entityManager, log)
        await expect(
            handler.execute(
                new AppendLogLineCommand({
                    request: { actorId: "p1", action: AuditAction.SignedIn, target: null, at: AT },
                }),
            ),
        ).rejects.toThrow("chain lock lost")
    })
})
