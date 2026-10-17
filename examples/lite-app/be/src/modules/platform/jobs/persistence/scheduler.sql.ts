import { sql } from "@modules/platform/database"

/** Reads the migration-owned booking scheduler registration. */
export const READ_BOOKING_SCHEDULE = sql`SELECT jobid, schedule, command FROM private.booking_reminder_schedule() LIMIT 2`
/** Reapplies the migration-owned fixed schedule. */
export const REGISTER_BOOKING_SCHEDULE = sql`SELECT private.register_booking_reminder_schedule() AS jobid`
/** Runs the migration-owned enqueue-only tick. */
export const RUN_BOOKING_TICK = sql`select private.booking_reminder_tick()`
