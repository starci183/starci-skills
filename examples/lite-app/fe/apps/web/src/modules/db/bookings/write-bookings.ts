"use server"
import "server-only"

import type { Database } from "../../../../../../../supabase/types/database.types"
import { getPrincipal } from "../principal"
import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { insertRow, rowSchema } from "../server"

/** One bookings row returned after a successful write. */
type BookingsRow = Database["public"]["Tables"]["bookings"]["Row"]

/** Table writer. */ export const writeBookings = async (input: unknown): Promise<DbOutcome<BookingsRow>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = rowSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "bookings-input")
    return insertRow(parsed.data.id, principal.value.id, (db, row) => db.from("bookings").insert(row).select().single())
}
