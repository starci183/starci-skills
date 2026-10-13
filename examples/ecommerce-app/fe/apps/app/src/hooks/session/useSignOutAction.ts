import { useState } from "react"
import { useTranslations } from "next-intl"
import { authClient } from "@/modules/auth"
import { useGraphQLWithToast } from "@/modules/toast"
import { useMutateRevokeSessionSwr } from "../swr"

/**
 * Owns the sign-out press: the session is revoked at the identity service first and forgotten in the browser second. The
 * revoke is best-effort - a dead token must never trap the session in the browser - and every page re-reads as signed out
 * through the session state.
 */
export const useSignOutAction = () => {
    const t = useTranslations("shop.account.auth")
    const runGraphQL = useGraphQLWithToast()
    const revoke = useMutateRevokeSessionSwr()
    const [working, setWorking] = useState(false)
    const onSignOut = async () => {
        setWorking(true)
        const sessionToken = await authClient.accessToken()
        if (sessionToken !== undefined)
            await runGraphQL(() => revoke.trigger({ sessionToken }), { successMessage: t("signedOut") })
        authClient.end()
        setWorking(false)
    }
    const state: "ready" | "working" = working ? "working" : "ready"
    return { state, props: { label: t("signOut") }, on: { onSignOut } }
}
