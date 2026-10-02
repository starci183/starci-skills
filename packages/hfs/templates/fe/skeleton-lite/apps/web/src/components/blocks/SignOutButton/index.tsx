"use client"

import { useTranslations } from "next-intl"
import { useSignOut } from "@/hooks/auth"
import { SignOutButtonBase } from "./component"

/** The connected control that ends the current browser session. */
export const SignOutButton = () => {
    const t = useTranslations("app.signOut")
    const { failure, pending, signOut } = useSignOut()
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
