"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { writeSignOut } from "@/modules/db/auth/write-sign-out"
import { navigation } from "@/modules/i18n"
import { SignOutButtonBase } from "./component"

type SignOutFailure = "refused" | "not-found" | "invalid" | "unavailable"

/** The connected control that ends the current browser session. */
export const SignOutButton = () => {
    const router = navigation.useRouter()
    const t = useTranslations("app.signOut")
    const [failure, setFailure] = useState<SignOutFailure>()
    const [pending, startTransition] = useTransition()
    const signOut = () => {
        startTransition(async () => {
            const outcome = await writeSignOut()
            if (outcome.kind !== "ok") {
                setFailure(outcome.kind)
                return
            }
            setFailure(undefined)
            router.refresh()
        })
    }
    return (
        <SignOutButtonBase
            props={{
                label: pending ? t("working") : t("submit"),
                pending,
                failure: failure === undefined ? undefined : t(failure),
            }}
            on={{ press: signOut }}
        />
    )
}
