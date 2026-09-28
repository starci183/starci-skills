"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useSessionToken } from "@/hooks/auth"
import { signOut } from "@/modules/api/auth"
import { clearToken } from "@/modules/session"
import { TasksPageBase } from "./component"

/** The task screen's connected entry resolves copy, session and sign-out. */
export const TasksPage = () => {
    const t = useTranslations("shell")
    const tTasks = useTranslations("tasks")
    const token = useSessionToken()
    const router = useRouter()

    const onSignOut = () => {
        clearToken()
        if (token) void signOut(token)
        router.push("/sign-in")
    }

    return <TasksPageBase
        onSignOut={onSignOut}
        copy={{
            brand: t("brand"),
            navPrimary: t("navPrimary"),
            navLegal: t("navLegal"),
            accountName: t("accountName"),
            signOut: t("signOut"),
            destinations: {
                tasks: t("destinations.tasks"),
                notifications: t("destinations.notifications"),
                plan: t("destinations.plan"),
                privacy: t("destinations.privacy"),
            },
            legal: {
                privacyPolicy: t("legal.privacyPolicy"),
                terms: t("legal.terms"),
            },
            mainLabel: tTasks("mainLabel"),
            heading: tTasks("heading"),
            tagline: tTasks("tagline"),
        }}
    />
}