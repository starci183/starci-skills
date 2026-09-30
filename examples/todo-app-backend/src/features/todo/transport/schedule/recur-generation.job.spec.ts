import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { GenerateRecurrencesCommand } from "../../application/generate-recurrences.command"
import { RecurGenerationJob } from "./recur-generation.job"

describe("RecurGenerationJob", () => {
    it("is named recur.generation and runs on the cron of the recur options", () => {
        const job = new RecurGenerationJob(mock<CommandBus>(), { tickCron: "*/5 * * * *" })
        expect(job.name).toBe("recur.generation")
        expect(job.schedule).toEqual({ cron: "*/5 * * * *" })
    })

    it("takes another cron when the option says so", () => {
        expect(new RecurGenerationJob(mock<CommandBus>(), { tickCron: "* * * * *" }).schedule).toEqual({ cron: "* * * * *" })
    })

    it("dispatches exactly one generation command carrying the tick instant", async () => {
        const at = new Date("2026-09-30T10:05:00.000Z")
        const commandBus = mock<CommandBus>({ execute: jest.fn().mockResolvedValue({ materialised: 0, deferred: 0 }) })
        await new RecurGenerationJob(commandBus, { tickCron: "*/5 * * * *" }).run(at)
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(new GenerateRecurrencesCommand({ request: { at } }))
    })

    it("lets a failing generation surface so the scheduler gives the lease back", async () => {
        const failure = new Error("database down")
        const commandBus = mock<CommandBus>({ execute: jest.fn().mockRejectedValue(failure) })
        await expect(new RecurGenerationJob(commandBus, { tickCron: "*/5 * * * *" }).run(new Date("2026-09-30T10:05:00.000Z"))).rejects.toBe(failure)
    })
})
