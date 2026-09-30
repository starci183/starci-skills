"use client"

import { useTranslations } from "next-intl"
import { useLocaleSwitch } from "@/hooks/navigation"
import { useTheme } from "@/hooks/theme"
import { DisplayControlsView } from "./component"

/** The display controls take nothing from their page: the theme and the locale are read where they live. */
type DisplayControlsBlockProps = Record<never, never>

/**
 * The connected owner of the two reader-facing display choices: the persisted theme and the locale
 * in the address. It reads both from their hooks, resolves the words from the `shell.theme` and
 * `shell.locale` namespaces, and hands the pure view only values and two change handlers.
 */
export const DisplayControlsBlock = (props: DisplayControlsBlockProps) => {
    void props
    const t = useTranslations("shell")
    const { theme, setTheme } = useTheme()
    const { locale, locales, switchTo } = useLocaleSwitch()
    return (
        <DisplayControlsView
            theme={theme}
            locale={locale}
            copy={{
                theme: {
                    label: t("theme.label"),
                    light: t("theme.light"),
                    dark: t("theme.dark"),
                    system: t("theme.system"),
                },
                locale: { label: t("locale.label"), en: t("locale.en"), vi: t("locale.vi") },
            }}
            onThemeChange={(value) => {
                if (value === "light" || value === "dark" || value === "system") setTheme(value)
            }}
            onLocaleChange={(value) => {
                const next = locales.find((candidate) => candidate === value)
                if (next !== undefined) switchTo(next)
            }}
        />
    )
}
