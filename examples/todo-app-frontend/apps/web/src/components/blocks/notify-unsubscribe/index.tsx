"use client"

import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useUnsubscribeLink } from "@/hooks/notify"
import { NotifyUnsubscribeView } from "./component"

/**
 * The connected owner of the derived unsubscribe-link screen: it reads the email link's `token`
 * parameter, hands it to `useUnsubscribeLink` (which runs the backend's session-bound `unsubscribe`
 * mutation with that token as the bearer credential), and hands the resolved lifecycle state to the
 * pure view in ./component.tsx. It never requires a stored sign-in: the
 * link's token IS the credential.
 */
export const NotifyUnsubscribeBlock = () => {
    const t = useTranslations("notify.unsubscribe")
    const tShell = useTranslations("shell")
    const searchParams = useSearchParams()
    const token = searchParams.get("token")
    const { state, unsubscribe } = useUnsubscribeLink(token)

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
            onUnsubscribe={unsubscribe}
        />
    )
}
