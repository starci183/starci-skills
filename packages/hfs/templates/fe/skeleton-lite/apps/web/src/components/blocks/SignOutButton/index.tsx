"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { authClient } from "@/modules/auth"
import { useAppSelector } from "@/redux"
import { SignOutButtonBase } from "./component"

type SignOutFailure = "refused" | "invalid" | "unavailable"

/** The signed-in reader and the control that ends the browser session through modules/auth. */
export const SignOutButton = () => {
    const session = useAppSelector((state) => state.session)
    const t = useTranslations("app.signOut")
    const [failure, setFailure] = useState<SignOutFailure>()
    const [pending, startTransition] = useTransition()
    if (session.status !== "signed-in") return null
    const signOut = () => {
        startTransition(async () => {
            const outcome = await authClient.signOut()
            setFailure(outcome.kind === "ok" ? undefined : outcome.kind)
        })
    }
    return (
        <SignOutButtonBase
            props={{
                principal: session.session?.email ?? t("signedIn"),
                label: pending ? t("working") : t("submit"),
                pending,
                failure: failure === undefined ? undefined : t(failure),
            }}
            on={{ press: signOut }}
        />
    )
}
