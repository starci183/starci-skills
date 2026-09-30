"use client"

import { useTranslations } from "next-intl"
import { useUnsubscribeLink } from "@/hooks/notify"
import { NotifyUnsubscribeView } from "./component"

/** The unsubscribe block's only external input: the email link's `token`, or null when the link carries none. */
type NotifyUnsubscribeBlockProps = {
    readonly token: string | null
}

/**
 * The connected owner of the derived unsubscribe-link screen: it takes the email link's `token`
 * parameter from its page, hands it to `useUnsubscribeLink` (which runs the backend's session-bound `unsubscribe`
 * mutation with that token as the bearer credential), and hands the resolved lifecycle state to the
 * pure view in ./component.tsx. It never requires a stored sign-in: the
 * link's token IS the credential.
 */
export const NotifyUnsubscribeBlock = (props: NotifyUnsubscribeBlockProps) => {
    const t = useTranslations("notify.unsubscribe")
    const tShell = useTranslations("shell")
    const token = props.token
    const { state, unsubscribe } = useUnsubscribeLink(token)

    return (
        <NotifyUnsubscribeView
            state={state}
            tokenMissing={token === null || token === ""}
            copy={{
                brand: tShell("brand"),
                legalLabel: tShell("navLegal"),
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
