import { useState } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "@ecommerce/shared/hooks/i18n"
import { closeSession } from "../../modules/api/session"

/** Owns the sign-out press and refreshes the server account view after the session door answers. */
export const useSignOutAction = () => {
    const t = useTranslations("shop.account.auth")
    const router = useRouter()
    const [working, setWorking] = useState(false)
    const onSignOut = async () => {
        setWorking(true)
        await closeSession()
        router.refresh()
        setWorking(false)
    }
    const state: "ready" | "working" = working ? "working" : "ready"
    return { state, props: { label: t("signOut") }, on: { onSignOut } }
}
