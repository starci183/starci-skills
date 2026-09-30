"use client"

import { useTranslations } from "next-intl"
import { useSignOut } from "@/hooks/auth"
import { TasksPageBase } from "./component"

/** The task screen's connected entry: it resolves the copy and the sign-out action the shell draws. */
export const TasksPage = () => {
    const t = useTranslations("shell")
    const tTasks = useTranslations("tasks")
    const onSignOut = useSignOut()

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
