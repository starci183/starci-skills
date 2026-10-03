"use server"
import "server-only"

import { getPrincipal } from "../principal"
import { dbFailure } from "../outcome"
import { insertRow } from "../server"
import { rowSchema } from "../validation/validation.mapper"

/** Writes one validated resources row for the current principal. */
export const writeResources = async (input: unknown) => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = rowSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "resources-input")
    return insertRow(parsed.data.id, principal.value.id, (db, row) =>
        db.from("resources").insert(row).select().single(),
    )
}
