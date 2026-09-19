"use client"

import { useLocale, useTranslations } from "next-intl"
import { useFeKitI18n } from "../../../i18n/i18n-context"
import { LocaleSwitcherBase } from "./component"

/** The public props of the locale switcher. */
export type LocaleSwitcherProps = {
    /**
     * `pill` draws the bordered floating group the shell uses; `plain` keeps the same control
     * unframed for a surface that draws its own boundary.
     */
    readonly appearance?: "pill" | "plain";
};

/**
 * The reader's switch for the locale in the address: one locale-aware link per shipped language,
 * each pointing at the page the reader is already on. The created-navigation `usePathname`
 * returns the path WITHOUT the segment, so the links differ only in the `locale` prop - which is
 * the whole point of routing the language. Locales and navigation arrive through
 * `FeKitI18nProvider`, and the copy from the `shell.locale` message namespace: `label` plus one
 * key per shipped locale.
 */
export const LocaleSwitcher = (props: LocaleSwitcherProps) => {
    const t = useTranslations("shell.locale")
    const locale = useLocale()
    const { locales, navigation } = useFeKitI18n()
    const pathname = navigation.usePathname()
    return (
        <LocaleSwitcherBase
            appearance={props.appearance}
            label={t("label")}
            Link={navigation.Link}
            options={locales.map((option: string) => ({
                locale: option,
                label: t(option),
                href: pathname,
                current: locale === option,
            }))}
        />
    )
}
