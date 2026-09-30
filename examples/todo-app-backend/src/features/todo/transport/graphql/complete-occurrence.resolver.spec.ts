import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { RecurError, RecurErrorCode } from "@modules/domain/recur"
import type { Principal } from "@modules/platform/cqrs"
import { CompleteOccurrenceCommand } from "../../application/complete-occurrence.command"
import { CompleteOccurrenceResolver } from "./complete-occurrence.resolver"

const principal: Principal = { id: "o1", roles: ["member"] }

describe("CompleteOccurrenceResolver", () => {
    it("dispatches one complete command carrying the principal and answers the occurrence", async () => {
        const value = { occurrenceId: "t1", status: "completed" }
        const commandBus = mock<CommandBus>({ execute: jest.fn().mockResolvedValue({ kind: "ok", value }) })
        await expect(new CompleteOccurrenceResolver(commandBus).completeOccurrence(principal, { occurrenceId: "t1" })).resolves.toEqual(value)
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(new CompleteOccurrenceCommand({ request: { occurrenceId: "t1" }, principal }))
    })

    it("turns the refusal for a stranger into the recur error", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "refused", code: RecurErrorCode.OccurrenceForbidden }),
        })
        const call = new CompleteOccurrenceResolver(commandBus).completeOccurrence(principal, { occurrenceId: "t1" })
        await expect(call).rejects.toBeInstanceOf(RecurError)
        await expect(call).rejects.toMatchObject({ code: RecurErrorCode.OccurrenceForbidden })
    })
})
