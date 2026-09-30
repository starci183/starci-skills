import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { RecurError, RecurErrorCode, RuleFrequency } from "@modules/domain/recur"
import type { Principal } from "@modules/platform/cqrs"
import { MakeRecurringCommand } from "../../application/make-recurring.command"
import { MakeRecurringResolver } from "./make-recurring.resolver"

const principal: Principal = { id: "o1", roles: ["member"] }
const input = {
    title: "Stand-up",
    frequency: RuleFrequency.EveryWeekday,
    timeZone: "Asia/Ho_Chi_Minh",
    time: "09:00",
    startDate: "2026-09-14",
}

describe("MakeRecurringResolver", () => {
    it("dispatches one make command carrying the principal and answers the created rule", async () => {
        const made = { ruleId: "r1", ...input }
        const commandBus = mock<CommandBus>({ execute: jest.fn().mockResolvedValue({ kind: "ok", value: made }) })
        await expect(new MakeRecurringResolver(commandBus).makeRecurring(principal, input)).resolves.toEqual(made)
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(
            new MakeRecurringCommand({ request: { ...input, n: null, dayOfMonth: null }, principal }),
        )
    })

    it("turns the refusal of an invalid shape into the recur error carrying its reason", async () => {
        const params = { reason: "n-required" }
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "refused", code: RecurErrorCode.RuleInvalid, params }),
        })
        const call = new MakeRecurringResolver(commandBus).makeRecurring(principal, { ...input, frequency: RuleFrequency.EveryNDays })
        await expect(call).rejects.toBeInstanceOf(RecurError)
        await expect(call).rejects.toMatchObject({ code: RecurErrorCode.RuleInvalid, params })
    })
})
