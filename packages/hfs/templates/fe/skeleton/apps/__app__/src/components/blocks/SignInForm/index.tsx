"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { authClient } from "@/modules/auth"
import { useAppSelector } from "@/redux"
import { SignInFormBase } from "./component"

type SignInFailure = "refused" | "invalid" | "unavailable"

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

/** The sign-in form of a signed-out reader, wired to modules/auth; the session effect updates redux on success. */
export const SignInForm = () => {
    const status = useAppSelector((state) => state.session.status)
    const t = useTranslations("app.signIn")
    const [failure, setFailure] = useState<SignInFailure>()
    const [pending, startTransition] = useTransition()
    if (status !== "signed-out") return null
    const submit = (input: FormData) => {
        const credentials = credentialsOf(input)
        if (credentials === undefined) {
            setFailure("invalid")
            return
        }
        startTransition(async () => {
            const outcome = await authClient.signInWithPassword(credentials.email, credentials.password)
            setFailure(outcome.kind === "ok" ? undefined : outcome.kind)
        })
    }
    return (
        <SignInFormBase
            state={stateOf(pending, failure)}
            props={{
                title: t("title"),
                emailLabel: t("email"),
                passwordLabel: t("password"),
                submitLabel: pending ? t("working") : t("submit"),
                failure: failure === undefined ? undefined : t(failure),
            }}
            on={{ submit }}
        />
    )
}
