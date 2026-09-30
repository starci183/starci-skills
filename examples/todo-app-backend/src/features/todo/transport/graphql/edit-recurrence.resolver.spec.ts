import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { RecurError, RecurErrorCode, RuleFrequency } from "@modules/domain/recur"
import type { Principal } from "@modules/platform/cqrs"
import { EditRecurrenceCommand } from "../../application/edit-recurrence.command"
import { EditRecurrenceResolver } from "./edit-recurrence.resolver"

const principal: Principal = { id: "o1", roles: ["member"] }

describe("EditRecurrenceResolver", () => {
    it("dispatches one edit command carrying the principal and answers the edited rule", async () => {
        const edited = { ruleId: "r1", frequency: RuleFrequency.EveryWeekday, timeZone: "Europe/Berlin", time: "10:30" }
        const commandBus = mock<CommandBus>({ execute: jest.fn().mockResolvedValue({ kind: "ok", value: edited }) })
        await expect(new EditRecurrenceResolver(commandBus).editRecurrence(principal, { ruleId: "r1", time: "10:30" })).resolves.toEqual(edited)
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(
            new EditRecurrenceCommand({ request: expect.objectContaining({ ruleId: "r1", time: "10:30" }), principal }),
        )
    })

    it("turns the refusal for a stranger into the recur error", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "refused", code: RecurErrorCode.RuleForbidden }),
        })
        const call = new EditRecurrenceResolver(commandBus).editRecurrence(principal, { ruleId: "r1" })
        await expect(call).rejects.toBeInstanceOf(RecurError)
        await expect(call).rejects.toMatchObject({ code: RecurErrorCode.RuleForbidden })
    })
})
