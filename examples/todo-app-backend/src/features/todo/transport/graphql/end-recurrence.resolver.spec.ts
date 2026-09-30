import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { RecurError, RecurErrorCode } from "@modules/domain/recur"
import type { Principal } from "@modules/platform/cqrs"
import { EndRecurrenceCommand } from "../../application/end-recurrence.command"
import { EndRecurrenceResolver } from "./end-recurrence.resolver"

const principal: Principal = { id: "o1", roles: ["member"] }
const input = { ruleId: "r1", endedAt: "2026-09-20" }

describe("EndRecurrenceResolver", () => {
    it("dispatches one end command carrying the principal and answers the ended rule", async () => {
        const ended = { ruleId: "r1", endedAt: "2026-09-20", orphanedCount: 2 }
        const commandBus = mock<CommandBus>({ execute: jest.fn().mockResolvedValue({ kind: "ok", value: ended }) })
        await expect(new EndRecurrenceResolver(commandBus).endRecurrence(principal, input)).resolves.toEqual(ended)
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(new EndRecurrenceCommand({ request: input, principal }))
    })

    it("turns the refusal for an unknown rule into the recur error", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "refused", code: RecurErrorCode.RuleNotFound }),
        })
        const call = new EndRecurrenceResolver(commandBus).endRecurrence(principal, input)
        await expect(call).rejects.toBeInstanceOf(RecurError)
        await expect(call).rejects.toMatchObject({ code: RecurErrorCode.RuleNotFound })
    })
})
