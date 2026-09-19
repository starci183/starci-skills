"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { unsubscribeFromEmail } from "../api"
import { NotifyUnsubscribeView, type NotifyUnsubscribeState } from "./component"

/** NotifyUnsubscribeBlock takes no external props; the link token and the write lifecycle are its own. */
export type NotifyUnsubscribeBlockProps = Record<never, never>

/**
 * The connected owner of the derived unsubscribe-link screen: it reads the email link's `token`
 * parameter, runs the backend's session-bound `unsubscribe` mutation with that token as the bearer
 * credential (link token validation and failure both stay on the backend contract - an absent,
 * unknown or expired token is refused by `SessionService.findActive`), and hands the resolved
 * lifecycle state to the pure view in ./component.tsx. It never requires a stored sign-in: the
 * link's token IS the credential.
 */
export const NotifyUnsubscribeBlock = (props: NotifyUnsubscribeBlockProps) => {
    void props
    const t = useTranslations("notify.unsubscribe")
    const tShell = useTranslations("shell")
    const searchParams = useSearchParams()
    const token = searchParams.get("token")
    const [state, setState] = useState<NotifyUnsubscribeState>("idle")

    const onUnsubscribe = async () => {
        if (token === null || token === "" || state === "pending" || state === "unsubscribed") return
        setState("pending")
        try {
            await unsubscribeFromEmail(token)
            setState("unsubscribed")
        } catch {
            setState("refused")
        }
    }

    return (
        <NotifyUnsubscribeView
            state={state}
            tokenMissing={token === null || token === ""}
            copy={{
                brand: tShell("brand"),
                legal: {
                    privacyPolicy: tShell("legal.privacyPolicy"),
                    terms: tShell("legal.terms"),
                },
                mainLabel: t("mainLabel"),
                heading: t("heading"),
                tagline: t("tagline"),
                tokenMissing: t("tokenMissing"),
                done: t("done"),
                refused: t("refused"),
                action: t("action"),
                pending: t("pending"),
            }}
            onUnsubscribe={onUnsubscribe}
        />
    )
}
