import "server-only"

import { cache } from "react"
import { createServerDbClient } from "./server"
import { dbFailure, dbOk, toOutcome } from "./outcome"
import type { DbOutcome } from "./outcome"

/** The trusted caller claims exposed to server readers and writers. */
export interface Principal {
    readonly id: string
    readonly email?: string
}

/** Keeps only the claims a consumer may trust after `getClaims()` verified the token. */
export const principalFromClaims = (claims: Readonly<Record<string, unknown>>): DbOutcome<Principal> => {
    if (typeof claims.sub !== "string") return dbFailure("refused", "claims")
    return dbOk({
        id: claims.sub,
        ...(typeof claims.email === "string" ? { email: claims.email } : {}),
    })
}

/** Verifies and memoizes the current request principal. */
export const getPrincipal = cache(async (): Promise<DbOutcome<Principal>> => {
    const client = await createServerDbClient()
    const claims = toOutcome(await client.auth.getClaims())
    if (claims.kind !== "ok") return claims
    return principalFromClaims(claims.value.claims)
})
