import { sql } from "@modules/platform/database"

/** Writes one pending public.bookings row for its owner and answers it ($1 owner, $2 resource, $3 start, $4 end). */
export const INSERT_BOOKING = sql`INSERT INTO public.bookings (owner_id, resource_id, starts_at, ends_at)
VALUES ($1, $2, $3, $4)
RETURNING id, resource_id, starts_at, ends_at, status`

/** Reads the confirmation status of one public.bookings row by id and owner ($1 id, $2 owner). */
export const FIND_BOOKING_STATUS = sql`SELECT id, status FROM public.bookings WHERE id = $1 AND owner_id = $2 LIMIT 1`

/** Moves one pending booking to confirmed; a confirmed booking is left as it is, so a repeated job changes nothing ($1 id). */
export const CONFIRM_BOOKING = sql`UPDATE public.bookings SET status = 'confirmed' WHERE id = $1 AND status = 'pending'`

/** Marks the reminder of one booking sent; a reminded booking is left as it is, so a repeated job changes nothing ($1 id). */
export const REMIND_BOOKING = sql`UPDATE public.bookings SET reminder_sent_at = now() WHERE id = $1 AND reminder_sent_at IS NULL`

/** The catch-up of the pg_cron tick: every confirmed booking that never got its reminder is marked reminded in one pass. */
export const REMIND_DUE_BOOKINGS = sql`UPDATE public.bookings SET reminder_sent_at = now()
    WHERE status = 'confirmed' AND reminder_sent_at IS NULL AND starts_at <= now() + interval '24 hours'`
