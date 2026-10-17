import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { READ_BOOKING_SCHEDULE, REGISTER_BOOKING_SCHEDULE, RUN_BOOKING_TICK } from "./persistence/scheduler.sql"
import { SchedulerClient } from "./scheduler.client"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [SchedulerClient] }).compile()
    return moduleRef.get(SchedulerClient)
}

describe("SchedulerClient", () => {
    it("reads the migration-owned registration on the caller's manager", async () => {
        const client = await build()
        const rows = [{ jobid: "7", schedule: "*/15 * * * *", command: RUN_BOOKING_TICK }]
        const manager = mockEntityManager({ query: [READ_BOOKING_SCHEDULE, rows] })

        await expect(client.schedules(manager)).resolves.toEqual(rows)

        expect(manager.query).toHaveBeenCalledTimes(1)
        expect(manager.query).toHaveBeenCalledWith(READ_BOOKING_SCHEDULE)
        expect(client.tickCommand).toBe(RUN_BOOKING_TICK)
    })

    it("returns no registrations when the migration-owned schedule is missing", async () => {
        const client = await build()
        const manager = mockEntityManager({ query: [READ_BOOKING_SCHEDULE, []] })

        await expect(client.schedules(manager)).resolves.toEqual([])

        expect(manager.query).toHaveBeenCalledTimes(1)
    })

    it("returns the stable identity when the fixed named registration is reapplied", async () => {
        const client = await build()
        const rows = [{ jobid: "7" }]
        const manager = mockEntityManager({ query: [REGISTER_BOOKING_SCHEDULE, rows] })

        await expect(client.register(manager)).resolves.toEqual(rows)
        await expect(client.register(manager)).resolves.toEqual(rows)

        expect(manager.query.mock.calls).toEqual([[REGISTER_BOOKING_SCHEDULE], [REGISTER_BOOKING_SCHEDULE]])
    })

    it("runs exactly one enqueue-only tick and discards the database result", async () => {
        const client = await build()
        const manager = mockEntityManager({ query: [RUN_BOOKING_TICK, [{ booking_reminder_tick: null }]] })

        await expect(client.tick(manager)).resolves.toBeUndefined()

        expect(manager.query).toHaveBeenCalledTimes(1)
        expect(manager.query).toHaveBeenCalledWith(client.tickCommand)
    })

    it("propagates a failed tick to the caller without retrying", async () => {
        const client = await build()
        const manager = mockEntityManager()
        const failure = new Error("tick failed")
        manager.query.mockRejectedValue(failure)

        await expect(client.tick(manager)).rejects.toBe(failure)

        expect(manager.query).toHaveBeenCalledTimes(1)
        expect(manager.query).toHaveBeenCalledWith(RUN_BOOKING_TICK)
    })
})
