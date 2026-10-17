import { useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useLocale, useTranslations } from "next-intl"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import type { GraphQLFailure } from "@ecommerce/api"
import { authClient } from "@/modules/auth"
import { SHOP_ROUTES } from "@/modules/routes"
import { useGraphQLWithToast } from "@/modules/toast"
import { useMutateRegisterSwr, useMutateSignInSwr } from "../swr"

type Mode = "sign-in" | "register"
type FormState = "ready" | "refused" | "working"

/** The two fields of the session form. */
type SessionFormValues = { readonly email: string; readonly password: string }

/** The translated labels and actions for the current session mode. */
const sessionFormCopy = (mode: Mode, t: ReturnType<typeof useTranslations<"shop.account.auth">>) => {
    return {
        title: mode === "sign-in" ? t("signInTitle") : t("registerTitle"),
        intro: mode === "sign-in" ? t("signInIntro") : t("registerIntro"),
        emailLabel: t("email"),
        passwordLabel: t("password"),
        passwordHint: mode === "register" ? t("passwordHint") : null,
        submit: mode === "sign-in" ? t("submitSignIn") : t("submitRegister"),
        submitting: mode === "sign-in" ? t("submittingSignIn") : t("submittingRegister"),
        switchMode: mode === "sign-in" ? t("switchToRegister") : t("switchToSignIn"),
        backToBrowse: t("backToBrowse"),
    }
}

/**
 * Owns the session form: the fields (react-hook-form with a zod schema whose messages are the catalogue's), the mode, the
 * refusal and the submit. `register` runs first in register mode, because registration issues no session of its own; then
 * `signIn` opens the session and modules/auth keeps it, so every page re-reads as signed in.
 */
export const useSessionForm = () => {
    const t = useTranslations("shop.account.auth")
    const locale = useLocale()
    const runGraphQL = useGraphQLWithToast()
    const signIn = useMutateSignInSwr()
    const register = useMutateRegisterSwr()
    const [mode, setMode] = useState<Mode>("sign-in")
    const copy = sessionFormCopy(mode, t)
    const [refusal, setRefusal] = useState<string | null>(null)
    const schema = useMemo(
        () => z.object({ email: z.email(t("invalid")), password: z.string().min(1, t("invalid")) }),
        [t],
    )
    const form = useForm<SessionFormValues>({
        resolver: zodResolver(schema),
        defaultValues: { email: "", password: "" },
    })
    const [email, password] = useWatch({ control: form.control, name: ["email", "password"] })

    /** The sentence a refused answer owes the reader: the stable code and kind pick the copy. */
    const refusalCopy = (failure: GraphQLFailure): string => {
        if (failure.error === "ACCOUNT_EMAIL_TAKEN") return t("taken")
        if (failure.kind === "unauthenticated") return t("refusal")
        return failure.kind === "invalid" ? t("invalid") : t("unavailable")
    }

    const submit = async (values: SessionFormValues) => {
        setRefusal(null)
        if (mode === "register") {
            const registered = await runGraphQL(() => register.trigger(values), { showSuccessToast: false })
            if (!registered.success) {
                setRefusal(refusalCopy(registered))
                return
            }
        }
        const issued = await runGraphQL(() => signIn.trigger(values), { successMessage: t("signedIn") })
        if (!issued.success) {
            setRefusal(refusalCopy(issued))
            return
        }
        authClient.establish(issued.data)
    }

    const onSubmit = () => {
        void form.handleSubmit(submit, () => setRefusal(t("invalid")))()
    }

    const onSwitchMode = () => {
        setMode(mode === "sign-in" ? "register" : "sign-in")
        setRefusal(null)
        form.setValue("password", "")
    }

    const working = signIn.isMutating || register.isMutating
    let state: FormState = "ready"
    if (refusal) state = "refused"
    else if (working) state = "working"
    return {
        state,
        props: {
            mode,
            email,
            password,
            refusal,
            browseHref: `/${locale}${SHOP_ROUTES.browse}`,
            copy,
        },
        on: {
            onEmailChange: (value: string) => form.setValue("email", value),
            onPasswordChange: (value: string) => form.setValue("password", value),
            onSubmit,
            onSwitchMode,
        },
    }
}
