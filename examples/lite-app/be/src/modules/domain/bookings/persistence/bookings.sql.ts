import { sql } from "@modules/platform/database"

/** Writes one pending public.bookings row for its owner and answers it ($1 owner, $2 resource, $3 start, $4 end). */
export const INSERT_BOOKING = sql`INSERT INTO public.bookings (owner_id, resource_id, starts_at, ends_at)
VALUES ($1, $2, $3, $4)
RETURNING id, resource_id, starts_at, ends_at, status`

/** Moves one pending booking to confirmed; a confirmed booking is left as it is, so a repeated job changes nothing ($1 id). */
export const CONFIRM_BOOKING = sql`UPDATE public.bookings SET status = 'confirmed' WHERE id = $1 AND status = 'pending'`
