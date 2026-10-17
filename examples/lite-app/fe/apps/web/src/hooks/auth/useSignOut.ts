"use client"

import { useTransition } from "react"
import { authClient } from "@/modules/auth"
import type { AuthFailure } from "@/modules/auth"
import { useGraphQLWithToast } from "@/modules/toast"

/** The app's one outcome of an auth call, so modules/toast reports it like any other write. */
const responseOf = (failure: AuthFailure | undefined) =>
    failure === undefined
        ? { success: true as const, data: null }
        : { success: false as const, error: failure.code, kind: failure.kind, message: failure.message }

/**
 * Ends the reader's session through modules/auth: whether the request runs and the sign-out itself. A failure is reported by
 * modules/toast; a success needs no toast, the session effect moves the reader to signed out.
 */
export const useSignOut = () => {
    const withToast = useGraphQLWithToast()
    const [pending, startTransition] = useTransition()
    const signOut = () =>
        startTransition(async () => {
            await withToast(async () => responseOf(await authClient.signOut()), { showSuccessToast: false })
        })
    return { pending, signOut }
}
