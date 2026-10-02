"use server"

import type { Database } from "../../../../../../../supabase/types/database.types"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { dbFailure, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"

export type BookingsRow = Database["public"]["Tables"]["bookings"]["Row"]

interface CreateBookingsInput {
    readonly id: string
}

interface ValidCreateBookings {
    readonly success: true
    readonly data: CreateBookingsInput
}

interface InvalidCreateBookings {
    readonly success: false
}

type CreateBookingsParse = ValidCreateBookings | InvalidCreateBookings

const createBookingsSchema = {
    safeParse: (input: unknown): CreateBookingsParse => {
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

/** Creates one bookings row for the verified principal. */
export const writeBookings = async (input: unknown): Promise<DbOutcome<BookingsRow>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = createBookingsSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "bookings-input")
    const client = await createServerDbClient()
    const row = { id: parsed.data.id, owner_id: principal.value.id }
    const result = await client.from("bookings").insert(row).select().single()
    return toOutcome(result)
}
