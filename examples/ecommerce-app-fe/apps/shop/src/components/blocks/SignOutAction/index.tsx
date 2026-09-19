"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "@shared/i18n/navigation"
import { closeSession } from "../../../modules/api/session"
import { SignOutActionBase } from "./component"

/** SignOutAction takes no external props; the press lifecycle is entirely its own. */
export type SignOutActionProps = Record<never, never>

/**
 * The connected sign-out: one press asks the shop's `/api/session` door to revoke the bearer at
 * the identity service and drop the `northwind-session` cookie, then refreshes the route so the
 * server render settles anonymous. The refresh runs even if the call itself failed — the door
 * clears the local cookie best-effort, and the surface must never trap a dead session.
 */
export const SignOutAction = (props: SignOutActionProps) => {
    void props
    const t = useTranslations("shop.account.auth")
    const router = useRouter()
    const [working, setWorking] = useState(false)

    const onSignOut = async () => {
        setWorking(true)
        await closeSession()
        router.refresh()
        setWorking(false)
    }

    return (
        <SignOutActionBase
            state={working ? "working" : "ready"}
            props={{ label: t("signOut") }}
            on={{ onSignOut }}
        />
    )
}
