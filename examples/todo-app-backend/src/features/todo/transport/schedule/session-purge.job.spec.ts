import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { PurgeLapsedSessionsCommand } from "../../application/purge-lapsed-sessions.command"
import { SessionPurgeJob } from "./session-purge.job"

const AT = new Date("2026-09-30T10:00:00.000Z")

describe("SessionPurgeJob", () => {
    it("is the hourly session.purge job", () => {
        const job = new SessionPurgeJob(mock<CommandBus>())
        expect(job.name).toBe("session.purge")
        expect(job.schedule).toEqual({ everyMs: 3_600_000 })
    })

    it("dispatches exactly one purge command carrying the tick", async () => {
        const commandBus = mock<CommandBus>({ execute: jest.fn().mockResolvedValue({ purged: 2 }) })
        await new SessionPurgeJob(commandBus).run(AT)
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(new PurgeLapsedSessionsCommand({ request: { at: AT } }))
    })

    it("lets a failing purge fail the run so the scheduler sees it", async () => {
        const failure = new Error("db down")
        const commandBus = mock<CommandBus>({ execute: jest.fn().mockRejectedValue(failure) })
        await expect(new SessionPurgeJob(commandBus).run(AT)).rejects.toBe(failure)
    })
})
