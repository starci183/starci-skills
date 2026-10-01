import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import type { Outcome } from "@ecommerce/api"
import { callDoor } from "../../modules/doors"
import { SHOP_ROUTES } from "../../modules/routes"
import { useLocaleRouter } from "../navigation"

type Mode = "sign-in" | "register"
type FormState = "ready" | "refused" | "working"

/** Owns the session form's input, request and refusal lifecycle. */
export const useSessionForm = () => {
    const t = useTranslations("shop.account.auth")
    const locale = useLocale()
    const router = useLocaleRouter()
    const [mode, setMode] = useState<Mode>("sign-in")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [working, setWorking] = useState(false)
    const [refusal, setRefusal] = useState<string | null>(null)

    /** The sentence a refused answer owes the reader: the door's stable code picks the copy, never a server sentence. */
    const refusalCopy = (outcome: Exclude<Outcome<unknown>, { readonly kind: "ok" }>): string => {
        if (outcome.kind === "refused") return t("refusal")
        if (outcome.kind === "invalid") return outcome.code === "ACCOUNT_EMAIL_TAKEN" ? t("taken") : t("invalid")
        return t("unavailable")
    }

    const onSubmit = async () => {
        setWorking(true)
        setRefusal(null)
        const outcome = await callDoor("session", "POST", { mode, email, password })
        setWorking(false)
        if (outcome.kind !== "ok") {
            setRefusal(refusalCopy(outcome))
            return
        }
        router.refresh()
    }

    const onSwitchMode = () => {
        setMode(mode === "sign-in" ? "register" : "sign-in")
        setRefusal(null)
        setPassword("")
    }

    const state: FormState = refusal ? "refused" : working ? "working" : "ready"
    return {
        state,
        props: {
            mode,
            email,
            password,
            refusal,
            browseHref: `/${locale}${SHOP_ROUTES.browse}`,
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
        },
        on: { onEmailChange: setEmail, onPasswordChange: setPassword, onSubmit, onSwitchMode },
    }
}
