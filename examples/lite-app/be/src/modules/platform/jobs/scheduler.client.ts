import type { EntityManager } from "typeorm"
import { READ_BOOKING_SCHEDULE, REGISTER_BOOKING_SCHEDULE, RUN_BOOKING_TICK } from "./persistence/scheduler.sql"

/** A migration-owned scheduler registration. */
export interface ScheduleRow {
    /** The stable named registration identity. */
    readonly jobid: string
    /** The registered cron expression. */
    readonly schedule: string
    /** The enqueue-only SQL command. */
    readonly command: string
}
/** The identity returned when the named schedule is reapplied. */
export interface ScheduleIdentity {
    /** The stable named registration identity. */
    readonly jobid: string
}
/** Local diagnostics for the migration-owned booking reminder schedule. */
export class SchedulerClient {
    /** The fixed command the migration schedules. */
    readonly tickCommand = RUN_BOOKING_TICK
    /** Observes the named registration through its migration-owned routine. */
    schedules(manager: EntityManager): Promise<Array<ScheduleRow>> {
        return manager.query<Array<ScheduleRow>>(READ_BOOKING_SCHEDULE)
    }
    /** Reapplies the fixed named registration, returning its identity. */
    register(manager: EntityManager): Promise<Array<ScheduleIdentity>> {
        return manager.query<Array<ScheduleIdentity>>(REGISTER_BOOKING_SCHEDULE)
    }
    /** Executes exactly one enqueue-only tick in the caller's transaction. */
    async tick(manager: EntityManager): Promise<void> {
        await manager.query(RUN_BOOKING_TICK)
    }
}
