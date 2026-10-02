"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { writeSignIn } from "@/modules/db/auth/write-sign-in"
import type { DbFailureKind } from "@/modules/db/outcome"
import { navigation } from "@/modules/i18n"
import { SignInFormBase } from "./component"

/** The interactive sign-in form wired to the schema-checked Server Action. */
export const SignInForm = () => {
    const router = navigation.useRouter()
    const t = useTranslations("app.signIn")
    const [failure, setFailure] = useState<DbFailureKind>()
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
            state={pending ? "working" : failure === undefined ? "ready" : "failed"}
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
