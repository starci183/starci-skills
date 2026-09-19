"use client"

import { useLocale, useTranslations } from "next-intl"
import { useFeKitI18n } from "../../../i18n/i18n-context"
import { useTheme } from "../../theme-context"
import { DisplayControlsBase } from "./component"

/**
 * The two reader-facing utilities every app chrome offers - flip the theme, switch the language -
 * drawn as grammar `TextAction` commands (`onPress`), never as links: neither is a destination.
 * ONE shared component, because the moment two surfaces spelled these toggles twice they would
 * disagree - a reader flipping to dark on one app and landing back in light on the other would
 * read the hand-off as a bug.
 *
 * Locales and navigation arrive through `FeKitI18nProvider`; the copy comes from the `display`
 * message namespace: `label`, `theme.toLight`, `theme.toDark` and one `locale.<code>` key per
 * shipped locale. The locale command toggles between the current locale and the first OTHER
 * entry, and goes through the created-navigation router, so the current path is re-prefixed
 * rather than the reader being dropped onto the other language's home page.
 */
export const DisplayControls = () => {
    const t = useTranslations("display")
    const locale = useLocale()
    const { locales, navigation } = useFeKitI18n()
    const pathname = navigation.usePathname()
    const router = navigation.useRouter()
    const { resolvedTheme, setTheme } = useTheme()

    const isDark = resolvedTheme === "dark"
    const nextLocale = locales.find((one: string) => one !== locale) ?? locales[0]

    return (
        <DisplayControlsBase
            label={t("label")}
            themeLabel={isDark ? t("theme.toLight") : t("theme.toDark")}
            localeLabel={t(`locale.${nextLocale}`)}
            onThemePress={() => setTheme(isDark ? "light" : "dark")}
            onLocalePress={() => router.replace(pathname, { locale: nextLocale })}
        />
    )
}
