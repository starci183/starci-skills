"use server"
import "server-only"

import type { Database } from "../../../../../../../supabase/types/database.types"
import { getPrincipal } from "../principal"
import { dbFailure, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { bookingSchema } from "../validation/validation.mapper"
import { createServerDbClient } from "../server"

/** One bookings row returned after a successful write. */
type BookingsRow = Database["public"]["Tables"]["bookings"]["Row"]

/** Table writer. */ export const writeBookings = async (input: unknown): Promise<DbOutcome<BookingsRow>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = bookingSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "bookings-input")
    const db = await createServerDbClient()
    return toOutcome(
        await db
            .from("bookings")
            .insert({
                id: parsed.data.id,
                owner_id: principal.value.id,
                resource_id: parsed.data.resourceId,
                starts_at: parsed.data.startsAt,
                ends_at: parsed.data.endsAt,
            })
            .select()
            .single(),
    )
}
