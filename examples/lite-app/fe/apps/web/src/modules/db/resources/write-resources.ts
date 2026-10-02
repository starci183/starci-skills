"use server"
import "server-only"

import type { Database } from "../../../../../../../supabase/types/database.types"
import { getPrincipal } from "../principal"
import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { rowSchema } from "../validation/validation.mapper"
import { insertRow } from "../server"

/** One resources row returned after a successful write. */
type ResourcesRow = Database["public"]["Tables"]["resources"]["Row"]

/** Table writer. */ export const writeResources = async (input: unknown): Promise<DbOutcome<ResourcesRow>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = rowSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "resources-input")
    return insertRow(parsed.data.id, principal.value.id, (db, row) =>
        db.from("resources").insert(row).select().single(),
    )
}
