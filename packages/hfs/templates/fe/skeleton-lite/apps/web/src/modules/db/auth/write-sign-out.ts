"use server"
import "server-only"

import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"

/** Ends the cookie-backed Supabase session, including an already-anonymous one. */
export const writeSignOut = async (): Promise<DbOutcome<true>> => {
    const principal = await getPrincipal()
    const client = await createServerDbClient()
    const result = await client.auth.signOut()
    if (result.error === null) return dbOk(true)
    if (principal.kind !== "ok" && result.error.status === 401) return dbOk(true)
    return dbFailure(result.error.status === 401 ? "refused" : "unavailable", result.error.code ?? "sign-out")
}
