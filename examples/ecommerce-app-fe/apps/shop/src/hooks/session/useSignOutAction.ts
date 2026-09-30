import { useState } from "react"
import { useTranslations } from "next-intl"
import { closeSession } from "../../modules/api"
import { useRouter } from "../../modules/i18n"

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
