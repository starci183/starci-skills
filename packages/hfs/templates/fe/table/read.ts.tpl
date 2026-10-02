import { cache } from "react"
import type { Database } from "../../../../../../../supabase/types/database.types"
import { createServerDbClient } from "../server"
import { toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"

export type {{Name}}Row = Database["public"]["Tables"]["{{table}}"]["Row"]

/** Reads a bounded page of {{table}} rows visible to the current RLS principal. */
export const read{{Name}} = cache(async (): Promise<DbOutcome<ReadonlyArray<{{Name}}Row>>> => {
    const client = await createServerDbClient()
    return toOutcome(await client.from("{{table}}").select("*").limit(100))
})
