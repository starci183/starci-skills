"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { useController, useForm } from "react-hook-form"
import type { Control } from "react-hook-form"
import { z } from "zod"
import { authClient } from "@/modules/auth"

/** Why a sign-in did not start a session: refused credentials, rejected input or the provider unavailable. */
export type SignInFailure = "refused" | "invalid" | "unavailable"

/** The bounded credentials, with the reader's-language messages of each bound. */
const signInSchemaOf = (t: (key: "emailInvalid" | "passwordShort" | "passwordLong") => string) =>
    z.object({
        email: z.email({ error: t("emailInvalid") }).max(254, { error: t("emailInvalid") }),
        password: z
            .string()
            .min(8, { error: t("passwordShort") })
            .max(256, { error: t("passwordLong") }),
    })

/** The values of the sign-in form. */
type SignInValues = z.infer<ReturnType<typeof signInSchemaOf>>

/** One controlled field of the form as a grammar Input takes it. */
const useField = (control: Control<SignInValues>, name: keyof SignInValues) => {
    const { field, fieldState } = useController({ control, name })
    return {
        value: field.value,
        errorMessage: fieldState.error?.message,
        change: field.onChange,
        blur: field.onBlur,
    }
}

/**
 * The sign-in form: react-hook-form with the zod schema, submitted to modules/auth (Supabase Auth in the browser). A success
 * changes nothing here: the session effect (hooks/effects) moves redux to signed-in.
 */
export const useSignInForm = () => {
    const t = useTranslations("app.signIn")
    const schema = useMemo(() => signInSchemaOf(t), [t])
    const form = useForm<SignInValues>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } })
    const [failure, setFailure] = useState<SignInFailure>()
    const email = useField(form.control, "email")
    const password = useField(form.control, "password")
    const submit = form.handleSubmit(async (values) => {
        const outcome = await authClient.signInWithPassword(values.email, values.password)
        setFailure(outcome.kind === "ok" ? undefined : outcome.kind)
    })
    return { fields: { email, password }, submit, isSubmitting: form.formState.isSubmitting, failure }
}
