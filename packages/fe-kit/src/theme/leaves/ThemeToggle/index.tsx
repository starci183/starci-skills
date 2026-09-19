"use client"

import { useTranslations } from "next-intl"
import { useTheme } from "../../theme-context"
import { ThemeToggleBase } from "./component"

/** The public props of the theme toggle. */
export type ThemeToggleProps = {
    /**
     * `pill` draws the bordered floating group the shell uses; `plain` keeps the same control
     * unframed for a surface that draws its own boundary.
     */
    readonly appearance?: "pill" | "plain";
};

/**
 * The reader's switch for the one persisted theme preference: three named choices rendered as a
 * pressed-state button group. All copy comes from the `shell.theme` message namespace - a consumer
 * ships `label`, `light`, `dark` and `system` keys there; the choice itself goes straight to the
 * provider, which owns storage, the OS follow and the root class.
 */
export const ThemeToggle = (props: ThemeToggleProps) => {
    const t = useTranslations("shell.theme")
    const { theme, setTheme } = useTheme()
    return (
        <ThemeToggleBase
            appearance={props.appearance}
            theme={theme}
            labels={{ group: t("label"), light: t("light"), dark: t("dark"), system: t("system") }}
            onSelect={setTheme}
        />
    )
}
