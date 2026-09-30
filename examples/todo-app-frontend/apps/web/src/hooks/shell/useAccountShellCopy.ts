import { useTranslations } from "next-intl"

/**
 * Every word the signed-in workspace chrome draws, resolved from the shared `shell` namespace plus the
 * screen's own `mainLabel` and `breadcrumb`, so no screen re-resolves the same dozen shell sentences
 * on its own.
 *
 * @param screen - The message namespace of the screen the chrome wraps.
 */
export const useAccountShellCopy = (screen: "notify.preferences" | "privacy") => {
    const t = useTranslations(screen)
    const tShell = useTranslations("shell")
    return {
        brand: tShell("brand"),
        accountName: tShell("accountName"),
        signOut: tShell("signOut"),
        navLabel: tShell("navPrimary"),
        destinations: {
            tasks: tShell("destinations.tasks"),
            notifications: tShell("destinations.notifications"),
            plan: tShell("destinations.plan"),
            privacy: tShell("destinations.privacy"),
        },
        legal: {
            privacyPolicy: tShell("legal.privacyPolicy"),
            terms: tShell("legal.terms"),
        },
        backToTasks: tShell("backToTasks"),
        breadcrumbLabel: tShell("breadcrumb"),
        mainLabel: t("mainLabel"),
        breadcrumb: t("breadcrumb"),
    }
}
