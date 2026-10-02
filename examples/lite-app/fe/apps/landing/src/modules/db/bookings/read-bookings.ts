import { cache } from "react"
import type { Database } from "../../../../../../../supabase/types/database.types"
import { createServerDbClient } from "../server"
import { toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"

export type BookingsRow = Database["public"]["Tables"]["bookings"]["Row"]

/** Reads a bounded page of bookings rows visible to the current RLS principal. */
export const readBookings = cache(async (): Promise<DbOutcome<ReadonlyArray<BookingsRow>>> => {
    const client = await createServerDbClient()
    return toOutcome(await client.from("bookings").select("*").limit(100))
})
