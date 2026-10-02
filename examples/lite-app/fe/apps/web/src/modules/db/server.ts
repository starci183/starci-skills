import "server-only"

import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import type { NextRequest, NextResponse } from "next/server"
import type { Database } from "../../../../../../supabase/types/database.types"
import { sessionCookieOptions, supabaseAnonKey, supabaseUrl } from "@/modules/config"
import { toOutcome } from "./outcome"
import type { DbOutcome, SupabaseData, SupabaseResult } from "./outcome"

interface OwnedRowInput {
    readonly id: string
}

type OwnedRowParse = { readonly success: true; readonly data: OwnedRowInput } | { readonly success: false }

/** The common id schema used by generated table Server Actions. */
export const rowSchema = {
    safeParse: (input: unknown): OwnedRowParse => {
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

interface OwnedRowIdentity {
    readonly id: string
    readonly owner_id: string
}

type InsertOwnedRow<T extends SupabaseResult> = (
    client: SupabaseClient<Database>,
    row: OwnedRowIdentity,
) => PromiseLike<T>

/** Creates the cookie-backed server client; the public key keeps every database call under RLS. */
export const createServerDbClient = async (): Promise<SupabaseClient<Database>> => {
    const store = await cookies()
    return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
        cookies: {
            getAll: () => store.getAll(),
            setAll: (changes) => {
                try {
                    for (const change of changes) {
                        store.set(change.name, change.value, {
                            ...change.options,
                            ...sessionCookieOptions,
                        })
                    }
                } catch (cause) {
                    if (!(cause instanceof Error) || !cause.message.includes("Cookies can only be modified"))
                        throw cause
                }
            },
        },
    })
}

/** Inserts one validated principal-owned row through the typed server client. */
export const insertRow = async <T extends SupabaseResult>(
    id: string,
    ownerId: string,
    insert: InsertOwnedRow<T>,
): Promise<DbOutcome<SupabaseData<T>>> => {
    const client = await createServerDbClient()
    return toOutcome(await insert(client, { id, owner_id: ownerId }))
}

/** Creates the proxy client and writes every refreshed cookie onto the response that will be returned. */
export const createRequestDbClient = (request: NextRequest, response: NextResponse): SupabaseClient<Database> =>
    createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
        cookies: {
            getAll: () => request.cookies.getAll(),
            setAll: (changes) => {
                for (const change of changes) {
                    request.cookies.set(change.name, change.value)
                    response.cookies.set(change.name, change.value, {
                        ...change.options,
                        ...sessionCookieOptions,
                    })
                }
            },
        },
    })
