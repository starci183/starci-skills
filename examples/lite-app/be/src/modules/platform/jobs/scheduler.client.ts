import type { EntityManager } from "typeorm"
import { READ_BOOKING_SCHEDULE, RUN_BOOKING_TICK } from "./persistence/scheduler.sql"

/** A migration-owned scheduler registration. */
export interface ScheduleRow {
    /** The stable named registration identity. */
    readonly jobid: string
    /** The registered cron expression. */
    readonly schedule: string
    /** The enqueue-only SQL command. */
    readonly command: string
}
/** The identity returned when the migration's named schedule is reapplied. */
export interface ScheduleIdentity {
    /** The stable named registration identity. */
    readonly jobid: string
}
/** The test world's capability to reapply the migration-owned declaration. */
export type ScheduleRegistration = () => Promise<Array<ScheduleIdentity>>
/** Local diagnostics for the migration-owned booking reminder schedule. */
export class SchedulerClient {
    /** The fixed command the migration schedules. */
    readonly tickCommand = RUN_BOOKING_TICK
    /** Observes the named registration through its migration-owned routine. */
    schedules(manager: EntityManager): Promise<Array<ScheduleRow>> {
        return manager.query<Array<ScheduleRow>>(READ_BOOKING_SCHEDULE)
    }
    /** Reapplies the declaration supplied by the local migration owner. */
    register(reapply: ScheduleRegistration): Promise<Array<ScheduleIdentity>> {
        return reapply()
    }
    /** Executes exactly one enqueue-only tick in the caller's transaction. */
    async tick(manager: EntityManager): Promise<void> {
        await manager.query(RUN_BOOKING_TICK)
    }
}
