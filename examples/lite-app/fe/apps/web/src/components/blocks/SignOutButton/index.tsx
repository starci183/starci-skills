"use client"

import { useTranslations } from "next-intl"
import { useSession, useSignOut } from "@/hooks/auth"
import { SignOutButtonBase } from "./component"

/** The signed-in reader and the control that ends the browser session (hooks/auth). */
export const SignOutButton = () => {
    const session = useSession()
    const t = useTranslations("app.signOut")
    const { signOut, isPending, failure } = useSignOut()
    if (session.status !== "signed-in") return null
    const failureMessages = {
        refused: t("refused"),
        invalid: t("invalid"),
        unavailable: t("unavailable"),
    } satisfies Record<NonNullable<typeof failure>, string>
    return (
        <SignOutButtonBase
            props={{
                principal: session.session?.email ?? t("signedIn"),
                label: isPending ? t("working") : t("submit"),
                pending: isPending,
                failure: failure === undefined ? undefined : failureMessages[failure],
            }}
            on={{ press: signOut }}
        />
    )
}
