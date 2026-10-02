"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { Button, Form, Input, SectionHeader, Text } from "@starci/grammar/common"
import { writeSignIn } from "@/modules/db/auth/write-sign-in"
import type { DbFailureKind } from "@/modules/db/outcome"

/** The anonymous sign-in surface wired to the schema-checked Server Action. */
export const SignInPage = () => {
    const router = useRouter()
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
        <>
            <SectionHeader title={t("title")} level={2} />
            <Form label={t("title")} isPending={pending} onSubmit={submit}>
                <Input id="sign-in-email" name="email" label={t("email")} kind="email" isRequired />
                <Input id="sign-in-password" name="password" label={t("password")} kind="password" isRequired />
                {failure === undefined ? null : <Text live="assertive">{t(failure)}</Text>}
                <Button type="submit" variant="primary" isPending={pending}>
                    {pending ? t("working") : t("submit")}
                </Button>
            </Form>
        </>
    )
}
