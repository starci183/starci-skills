"use client"

import { useTranslations } from "next-intl"
import { useSession, useSignOut } from "@/hooks/auth"
import { SignOutButtonBase } from "./component"

/** The signed-in reader and the control that ends the browser session. */
export const SignOutButton = () => {
    const session = useSession()
    const t = useTranslations("app.signOut")
    const { pending, signOut } = useSignOut()
    if (session.status !== "signed-in") return null
    return (
        <SignOutButtonBase
            props={{
                principal: session.session?.email ?? t("signedIn"),
                label: pending ? t("working") : t("submit"),
                pending,
            }}
            on={{ press: signOut }}
        />
    )
}
