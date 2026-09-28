import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "@ecommerce/shared/hooks/i18n"
import { openSession } from "../../modules/api/session"
import { ROUTES } from "../../modules/routes"

type Mode = "sign-in" | "register"
type FormState = "ready" | "refused" | "working"

/** Owns the session form's input, request and refusal lifecycle. */
export const useSessionForm = () => {
    const t = useTranslations("shop.account.auth")
    const locale = useLocale()
    const router = useRouter()
    const [mode, setMode] = useState<Mode>("sign-in")
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

    const state: FormState = refusal ? "refused" : working ? "working" : "ready"
    return {
        state,
        props: {
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
        },
        on: { onEmailChange: setEmail, onPasswordChange: setPassword, onSubmit, onSwitchMode },
    }
}
