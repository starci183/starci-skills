"use client"

import { useCallback, useState, useTransition } from "react"
import { authClient } from "@/modules/auth"

/** Why a sign-out did not end the session: refused, rejected or the provider unavailable. */
type SignOutFailure = "refused" | "invalid" | "unavailable"

/** Ends the browser session through modules/auth; the session effect moves redux to signed-out on success. */
export const useSignOut = () => {
    const [failure, setFailure] = useState<SignOutFailure>()
    const [isPending, startTransition] = useTransition()
    const signOut = useCallback(() => {
        startTransition(async () => {
            const outcome = await authClient.signOut()
            setFailure(outcome.kind === "ok" ? undefined : outcome.kind)
        })
    }, [])
    return { signOut, isPending, failure }
}
