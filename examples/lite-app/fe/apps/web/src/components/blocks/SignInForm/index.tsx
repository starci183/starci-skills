"use client"

import { useTranslations } from "next-intl"
import { useSession } from "@/hooks/auth"
import { useSignInForm } from "@/hooks/rhf"
import type { SignInFailure } from "@/hooks/rhf"
import { SignInFormBase } from "./component"

/** The state the form shows: working while a request runs, failed after a refusal, else ready. */
const stateOf = (pending: boolean, failure: SignInFailure | undefined): "working" | "ready" | "failed" => {
    if (pending) return "working"
    return failure === undefined ? "ready" : "failed"
}

/** The sign-in form of a signed-out reader (hooks/rhf); the session effect updates redux on success. */
export const SignInForm = () => {
    const session = useSession()
    const t = useTranslations("app.signIn")
    const { fields, submit, isSubmitting, failure } = useSignInForm()
    if (session.status !== "signed-out") return null
    const failureMessages = {
        refused: t("refused"),
        invalid: t("invalid"),
        unavailable: t("unavailable"),
    } satisfies Record<SignInFailure, string>
    return (
        <SignInFormBase
            state={stateOf(isSubmitting, failure)}
            props={{
                title: t("title"),
                emailLabel: t("email"),
                passwordLabel: t("password"),
                submitLabel: isSubmitting ? t("working") : t("submit"),
                failure: failure === undefined ? undefined : failureMessages[failure],
                email: { value: fields.email.value, errorMessage: fields.email.errorMessage },
                password: { value: fields.password.value, errorMessage: fields.password.errorMessage },
            }}
            on={{
                submit: () => void submit(),
                emailChange: fields.email.change,
                emailBlur: fields.email.blur,
                passwordChange: fields.password.change,
                passwordBlur: fields.password.blur,
            }}
        />
    )
}
