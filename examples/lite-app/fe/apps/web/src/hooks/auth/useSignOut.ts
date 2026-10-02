import { useState, useTransition } from "react"
import { signOutBrowserSession } from "@/modules/db/browser"
import { navigation } from "@/modules/i18n"

type SignOutFailure = "refused" | "not-found" | "invalid" | "unavailable"

/** Signs out through the client-safe database entry and refreshes the localized route. */
export const useSignOut = () => {
    const router = navigation.useRouter()
    const [failure, setFailure] = useState<SignOutFailure>()
    const [pending, startTransition] = useTransition()
    const signOut = () => {
        startTransition(async () => {
            const outcome = await signOutBrowserSession()
            if (outcome.kind !== "ok") {
                setFailure(outcome.kind)
                return
            }
            setFailure(undefined)
            router.refresh()
        })
    }
    return { failure, pending, signOut }
}
