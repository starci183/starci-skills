import { cache } from "react"
import type { Database } from "../../../../../../../supabase/types/database.types"
import { createServerDbClient } from "../server"
import { toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"

export type CalendarsRow = Database["public"]["Tables"]["calendars"]["Row"]

/** Reads a bounded page of calendars rows visible to the current RLS principal. */
export const readCalendars = cache(async (): Promise<DbOutcome<ReadonlyArray<CalendarsRow>>> => {
    const client = await createServerDbClient()
    return toOutcome(await client.from("calendars").select("*").limit(100))
})
