import { useState } from "react"
import { useTranslations } from "next-intl"
import { callDoor } from "../../modules/doors"
import { useLocaleRouter } from "../navigation"

/** Owns the sign-out press and refreshes the server account view after the session door answers. */
export const useSignOutAction = () => {
    const t = useTranslations("shop.account.auth")
    const router = useLocaleRouter()
    const [working, setWorking] = useState(false)
    const onSignOut = async () => {
        setWorking(true)
        await callDoor("session", "DELETE")
        router.refresh()
        setWorking(false)
    }
    const state: "ready" | "working" = working ? "working" : "ready"
    return { state, props: { label: t("signOut") }, on: { onSignOut } }
}
