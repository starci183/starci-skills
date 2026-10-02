"use server"

import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"

interface SignInInput {
    readonly email: string
    readonly password: string
}

type SignInParse = { readonly success: true; readonly data: SignInInput } | { readonly success: false }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The input schema at the Server Action boundary. */
const signInInputSchema = {
    safeParse: (input: FormData): SignInParse => {
        const email = input.get("email")
        const password = input.get("password")
        if (typeof email !== "string" || !EMAIL.test(email) || typeof password !== "string" || password === "") {
            return { success: false }
        }
        return { success: true, data: { email, password } }
    },
}

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
