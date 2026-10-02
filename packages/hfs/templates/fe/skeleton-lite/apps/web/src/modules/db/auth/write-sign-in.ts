"use server"
import "server-only"

import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { signInInputSchema } from "../schema"

/** Result exposed to the client boundary after sign-in. */
export interface SignInResult {
    readonly userId: string
}

/** Schema-checks credentials, signs in through the server client and returns a typed outcome. */
export const writeSignIn = async (input: FormData): Promise<DbOutcome<SignInResult>> => {
    const principal = await getPrincipal()
    if (principal.kind === "ok") return dbOk({ userId: principal.value.id })
    const parsed = signInInputSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "sign-in-input")
    const client = await createServerDbClient()
    const signedIn = toOutcome(await client.auth.signInWithPassword(parsed.data))
    if (signedIn.kind !== "ok") return signedIn
    return signedIn.value.user === null ? dbFailure("refused", "user") : dbOk({ userId: signedIn.value.user.id })
}
