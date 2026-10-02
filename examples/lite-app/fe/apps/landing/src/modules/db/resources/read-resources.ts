import { cache } from "react"
import type { Database } from "../../../../../../../supabase/types/database.types"
import { createServerDbClient } from "../server"
import { toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"

export type ResourcesRow = Database["public"]["Tables"]["resources"]["Row"]

/** Reads a bounded page of resources rows visible to the current RLS principal. */
export const readResources = cache(async (): Promise<DbOutcome<ReadonlyArray<ResourcesRow>>> => {
    const client = await createServerDbClient()
    return toOutcome(await client.from("resources").select("*").limit(100))
})
