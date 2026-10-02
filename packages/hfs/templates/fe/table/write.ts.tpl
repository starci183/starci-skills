"use server"
import "server-only"

import type { Database } from "../../../../../../../supabase/types/database.types"
import { getPrincipal } from "../principal"
import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { rowSchema } from "../validation/validation.mapper"
import { insertRow } from "../server"

/** One {{table}} row returned after a successful write. */
type {{Name}}Row = Database["public"]["Tables"]["{{table}}"]["Row"]

/** Table writer. */ export const write{{Name}} = async (input: unknown): Promise<DbOutcome<{{Name}}Row>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = rowSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "{{table}}-input")
    return insertRow(parsed.data.id, principal.value.id, (db, row) => db.from("{{table}}").insert(row).select().single())
}
