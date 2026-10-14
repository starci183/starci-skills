"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useFormField } from "@/hooks/fields"
import { authClient } from "@/modules/auth"

/** Why a sign-in did not start a session: refused credentials, rejected input or the provider unavailable. */
export type SignInFailure = "refused" | "invalid" | "unavailable"

/** The failure kinds modules/auth answers; any other kind reads as the provider being unavailable. */
const FAILURES: readonly SignInFailure[] = ["refused", "invalid", "unavailable"]

/** The failure of a sign-in's failure kind. */
const failureOf = (kind: string): SignInFailure => FAILURES.find((each) => each === kind) ?? "unavailable"

/** The bounded credentials, with the reader's-language messages of each bound. */
const signInSchemaOf = (messages: Readonly<Record<"emailInvalid" | "passwordShort" | "passwordLong", string>>) =>
    z.object({
        email: z.email({ error: messages.emailInvalid }).max(254, { error: messages.emailInvalid }),
        password: z
            .string()
            .min(8, { error: messages.passwordShort })
            .max(256, { error: messages.passwordLong }),
    })

/** The values of the sign-in form. */
type SignInValues = z.infer<ReturnType<typeof signInSchemaOf>>

/**
 * The sign-in form: react-hook-form with the zod schema, submitted to modules/auth (Supabase Auth in the browser). A success
 * changes nothing here: the session effect (hooks/effects) moves redux to signed-in.
 */
export const useSignInForm = () => {
    const t = useTranslations("app.signIn")
    const schema = useMemo(
        () =>
            signInSchemaOf({
                emailInvalid: t("emailInvalid"),
                passwordShort: t("passwordShort"),
                passwordLong: t("passwordLong"),
            }),
        [t],
    )
    const form = useForm<SignInValues>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } })
    const [failure, setFailure] = useState<SignInFailure>()
    const email = useFormField(form.control, "email")
    const password = useFormField(form.control, "password")
    const submit = form.handleSubmit(async (values) => {
        const failed = await authClient.signInWithPassword(values.email, values.password)
        setFailure(failed === undefined ? undefined : failureOf(failed.kind))
    })
    return { fields: { email, password }, submit, isSubmitting: form.formState.isSubmitting, failure }
}
