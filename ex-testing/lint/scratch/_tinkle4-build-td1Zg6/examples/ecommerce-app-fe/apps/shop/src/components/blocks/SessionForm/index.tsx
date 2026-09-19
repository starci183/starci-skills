"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "@shared/i18n/navigation"
import { openSession } from "../../../modules/api/session"
import { ROUTES } from "../../../modules/routes"
import { SessionFormBase } from "./component"
import type { SessionFormMode, SessionFormState } from "./component"

/** SessionForm takes no external props; the mode, the field values and the submit lifecycle are entirely its own. */
export type SessionFormProps = Record<never, never>

/**
 * The connected owner of the `ui.identity.sign-in` surface on `/account`: it holds the two field
 * values and the sign-in/register mode as intrinsic form state, submits the pair to the app's own
 * `/api/session` door, and maps the door's business code to dictionary copy — a wrong pair is the
 * one uniform refusal `br.identity.sign-in` requires, never which half; a refusal this surface
 * never claimed is shown as it arrived rather than relabeled. On success the route refreshes so
 * the server render re-reads the new `northwind-session` cookie.
 */
export const SessionForm = (props: SessionFormProps) => {
    void props
    const t = useTranslations("shop.account.auth")
    const locale = useLocale()
    const router = useRouter()
    const [mode, setMode] = useState<SessionFormMode>("sign-in")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [working, setWorking] = useState(false)
    const [refusal, setRefusal] = useState<string | null>(null)

    const refusalCopy = (code: string | undefined, reason: string): string => {
        if (code === "INVALID_CREDENTIALS") return t("refusal")
        if (code === "EMAIL_TAKEN") return t("taken")
        if (code === "REQUEST_INVALID") return t("invalid")
        if (code === "IDENTITY_UNAVAILABLE") return t("unavailable", { reason })
        return reason
    }

    const onSubmit = async () => {
        setWorking(true)
        setRefusal(null)
        const result = await openSession(mode, email, password)
        setWorking(false)
        if (!result.ok) {
            setRefusal(refusalCopy(result.code, result.reason))
            return
        }
        router.refresh()
    }

    const onSwitchMode = () => {
        setMode(mode === "sign-in" ? "register" : "sign-in")
        setRefusal(null)
        setPassword("")
    }

    const state: SessionFormState = refusal
        ? "refused"
        : working
            ? "working"
            : email || password
                ? "filled"
                : "empty"

    return (
        <SessionFormBase
            state={state}
            props={{
                mode,
                email,
                password,
                refusal,
                browseHref: `/${locale}${ROUTES.browse}`,
                copy: {
                    title: mode === "sign-in" ? t("signInTitle") : t("registerTitle"),
                    intro: mode === "sign-in" ? t("signInIntro") : t("registerIntro"),
                    emailLabel: t("email"),
                    passwordLabel: t("password"),
                    passwordHint: mode === "register" ? t("passwordHint") : null,
                    submit: mode === "sign-in" ? t("submitSignIn") : t("submitRegister"),
                    submitting: mode === "sign-in" ? t("submittingSignIn") : t("submittingRegister"),
                    switchMode: mode === "sign-in" ? t("switchToRegister") : t("switchToSignIn"),
                    backToBrowse: t("backToBrowse"),
                },
            }}
            on={{
                onEmailChange: setEmail,
                onPasswordChange: setPassword,
                onSubmit,
                onSwitchMode,
            }}
        />
    )
}
