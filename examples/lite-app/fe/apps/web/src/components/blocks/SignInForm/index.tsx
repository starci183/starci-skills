"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { writeSignIn } from "@/modules/db/auth/write-sign-in"
import { navigation } from "@/modules/i18n"
import { SignInFormBase } from "./component"

type SignInFailure = "refused" | "not-found" | "invalid" | "unavailable"

/** The state the form shows: working while a request runs, failed after a refusal, else ready. */
const stateOf = (pending: boolean, failure: SignInFailure | undefined): "working" | "ready" | "failed" => {
    if (pending) return "working"
    return failure === undefined ? "ready" : "failed"
}

/** The interactive sign-in form wired to the schema-checked Server Action. */
export const SignInForm = () => {
    const router = navigation.useRouter()
    const t = useTranslations("app.signIn")
    const [failure, setFailure] = useState<SignInFailure>()
    const [pending, startTransition] = useTransition()
    const submit = (input: FormData) => {
        startTransition(async () => {
            const outcome = await writeSignIn(input)
            if (outcome.kind === "ok") {
                setFailure(undefined)
                router.refresh()
                return
            }
            setFailure(outcome.kind)
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
