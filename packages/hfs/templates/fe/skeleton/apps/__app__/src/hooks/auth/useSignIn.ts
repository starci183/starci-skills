"use client"

import { useState, useTransition } from "react"
import { authClient } from "@/modules/auth"

/** Why a sign-in failed: refused credentials, rejected input or the provider unavailable. */
export type SignInFailure = "refused" | "invalid" | "unavailable"

/** The failure kinds modules/auth answers; any other kind reads as the provider being unavailable. */
const FAILURES: readonly SignInFailure[] = ["refused", "invalid", "unavailable"]

/** The failure of a sign-in's failure kind. */
const failureOf = (kind: string): SignInFailure => FAILURES.find((each) => each === kind) ?? "unavailable"

/**
 * Signs the reader in with an email and a password through modules/auth: whether a request runs, why the last one failed,
 * the sign-in itself and `reject` for input the form could not read. A success needs no state here: the session effect
 * moves the reader to signed in.
 */
export const useSignIn = () => {
    const [failure, setFailure] = useState<SignInFailure>()
    const [pending, startTransition] = useTransition()
    const signIn = (email: string, password: string) =>
        startTransition(async () => {
            const failed = await authClient.signInWithPassword(email, password)
            setFailure(failed === undefined ? undefined : failureOf(failed.kind))
        })
    return { failure, pending, signIn, reject: () => setFailure("invalid") }
}
