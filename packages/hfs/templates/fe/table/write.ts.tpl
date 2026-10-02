"use server"

import type { Database } from "../../../../../../../supabase/types/database.types"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { dbFailure, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"

export type {{Name}}Row = Database["public"]["Tables"]["{{table}}"]["Row"]

interface Create{{Name}}Input {
    readonly id: string
}

interface ValidCreate{{Name}} {
    readonly success: true
    readonly data: Create{{Name}}Input
}

interface InvalidCreate{{Name}} {
    readonly success: false
}

type Create{{Name}}Parse = ValidCreate{{Name}} | InvalidCreate{{Name}}

const create{{Name}}Schema = {
    safeParse: (input: unknown): Create{{Name}}Parse => {
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

/** Creates one {{table}} row for the verified principal. */
export const write{{Name}} = async (input: unknown): Promise<DbOutcome<{{Name}}Row>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = create{{Name}}Schema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "{{table}}-input")
    const client = await createServerDbClient()
    const row = { id: parsed.data.id, owner_id: principal.value.id }
    const result = await client.from("{{table}}").insert(row).select().single()
    return toOutcome(result)
}
