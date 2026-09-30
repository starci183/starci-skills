import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { RecurError, RecurErrorCode } from "@modules/domain/recur"
import type { Principal } from "@modules/platform/cqrs"
import { SkipOccurrenceCommand } from "../../application/skip-occurrence.command"
import { SkipOccurrenceResolver } from "./skip-occurrence.resolver"

const principal: Principal = { id: "o1", roles: ["member"] }

describe("SkipOccurrenceResolver", () => {
    it("dispatches one skip command carrying the principal and answers the occurrence", async () => {
        const value = { occurrenceId: "t1", status: "skipped" }
        const commandBus = mock<CommandBus>({ execute: jest.fn().mockResolvedValue({ kind: "ok", value }) })
        await expect(new SkipOccurrenceResolver(commandBus).skipOccurrence(principal, { occurrenceId: "t1" })).resolves.toEqual(value)
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(new SkipOccurrenceCommand({ request: { occurrenceId: "t1" }, principal }))
    })

    it("turns the refusal for an unknown occurrence into the recur error", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "refused", code: RecurErrorCode.OccurrenceNotFound }),
        })
        const call = new SkipOccurrenceResolver(commandBus).skipOccurrence(principal, { occurrenceId: "nope" })
        await expect(call).rejects.toBeInstanceOf(RecurError)
        await expect(call).rejects.toMatchObject({ code: RecurErrorCode.OccurrenceNotFound })
    })
})
