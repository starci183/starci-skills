"use client"

import { useTranslations } from "next-intl"
import { useSession, useSignIn } from "@/hooks/auth"
import type { SignInFailure } from "@/hooks/auth"
import { SignInFormBase } from "./component"

/** The state the form shows: working while a request runs, failed after a refusal, else ready. */
const stateOf = (pending: boolean, failure: SignInFailure | undefined): "working" | "ready" | "failed" => {
    if (pending) return "working"
    return failure === undefined ? "ready" : "failed"
}

/** The fields of the submitted form, or undefined when one is missing. */
const credentialsOf = (input: FormData): { readonly email: string; readonly password: string } | undefined => {
    const email = input.get("email")
    const password = input.get("password")
    return typeof email === "string" && typeof password === "string" ? { email, password } : undefined
}

/** The sign-in form of a signed-out reader; the session effect moves the reader to signed in on success. */
export const SignInForm = () => {
    const session = useSession()
    const t = useTranslations("app.signIn")
    const { failure, pending, signIn, reject } = useSignIn()
    if (session.status !== "signed-out") return null
    const failureMessages = {
        refused: t("refused"),
        invalid: t("invalid"),
        unavailable: t("unavailable"),
    } satisfies Record<SignInFailure, string>
    const submit = (input: FormData) => {
        const credentials = credentialsOf(input)
        if (credentials === undefined) reject()
        else signIn(credentials.email, credentials.password)
    }
    return (
        <SignInFormBase
            state={stateOf(pending, failure)}
            props={{
                title: t("title"),
                emailLabel: t("email"),
                passwordLabel: t("password"),
                submitLabel: pending ? t("working") : t("submit"),
                failure: failure === undefined ? undefined : failureMessages[failure],
            }}
            on={{ submit }}
        />
    )
}
