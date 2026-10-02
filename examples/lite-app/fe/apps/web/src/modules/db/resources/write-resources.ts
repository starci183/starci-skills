"use server"

import type { Database } from "../../../../../../../supabase/types/database.types"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { dbFailure, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"

export type ResourcesRow = Database["public"]["Tables"]["resources"]["Row"]

interface CreateResourcesInput {
    readonly id: string
}

interface ValidCreateResources {
    readonly success: true
    readonly data: CreateResourcesInput
}

interface InvalidCreateResources {
    readonly success: false
}

type CreateResourcesParse = ValidCreateResources | InvalidCreateResources

const createResourcesSchema = {
    safeParse: (input: unknown): CreateResourcesParse => {
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

/** Creates one resources row for the verified principal. */
export const writeResources = async (input: unknown): Promise<DbOutcome<ResourcesRow>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = createResourcesSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "resources-input")
    const client = await createServerDbClient()
    const row = { id: parsed.data.id, owner_id: principal.value.id }
    const result = await client.from("resources").insert(row).select().single()
    return toOutcome(result)
}
