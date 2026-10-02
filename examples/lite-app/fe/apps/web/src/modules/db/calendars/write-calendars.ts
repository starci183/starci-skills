"use server"

import type { Database } from "../../../../../../../supabase/types/database.types"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { dbFailure, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"

export type CalendarsRow = Database["public"]["Tables"]["calendars"]["Row"]

interface CreateCalendarsInput {
    readonly id: string
}

interface ValidCreateCalendars {
    readonly success: true
    readonly data: CreateCalendarsInput
}

interface InvalidCreateCalendars {
    readonly success: false
}

type CreateCalendarsParse = ValidCreateCalendars | InvalidCreateCalendars

const createCalendarsSchema = {
    safeParse: (input: unknown): CreateCalendarsParse => {
        if (
            typeof input !== "object" ||
            input === null ||
            !("id" in input) ||
            typeof input.id !== "string" ||
            input.id === ""
        ) {
            return { success: false }
        }
        return { success: true, data: { id: input.id } }
    },
}

/** Creates one calendars row for the verified principal. */
export const writeCalendars = async (input: unknown): Promise<DbOutcome<CalendarsRow>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = createCalendarsSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "calendars-input")
    const client = await createServerDbClient()
    const row = { id: parsed.data.id, owner_id: principal.value.id }
    const result = await client.from("calendars").insert(row).select().single()
    return toOutcome(result)
}
