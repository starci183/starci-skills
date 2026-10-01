"use client"

import { useEffect, useSyncExternalStore } from "react"
import { TextAction } from "@starci/grammar/common"
import { LOCALES, navigation } from "@ecommerce/i18n"
import { DISPLAY_CONTROLS_FRAME_CLASS_NAME } from "./classNames"

/** The words of the two commands, resolved by the layout that mounts them. */
type DisplayControlsProps = {
    /** The row's accessible name. */
    readonly label: string
    /** The locale the page is served in. */
    readonly locale: string
    readonly toLight: string
    readonly toDark: string
    /** The display name of each shipped locale. */
    readonly localeNames: Readonly<Record<(typeof LOCALES)[number], string>>
}

/** A theme that can actually be painted. */
type PaintedTheme = "light" | "dark"

const COOKIE_NAME = "northwind-theme"
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365
const OS_PREFERENCE = "(prefers-color-scheme: dark)"
const LISTENERS = new Set<() => void>()

/** The theme the page is painted in right now: the choice in the cookie, else the OS preference. */
const paintedTheme = (): PaintedTheme => {
    for (const pair of document.cookie.split("; ")) {
        const [name, value] = pair.split("=")
        if (name === COOKIE_NAME && (value === "light" || value === "dark")) return value
    }
    return window.matchMedia(OS_PREFERENCE).matches ? "dark" : "light"
}

/** Persist the reader's choice and tell every subscriber. */
const chooseTheme = (choice: PaintedTheme): void => {
    document.cookie = `${COOKIE_NAME}=${choice}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`
    for (const listener of LISTENERS) listener()
}

/** Subscribe to choice changes and to the OS preference; call the returned function to unsubscribe. */
const subscribeTheme = (listener: () => void): (() => void) => {
    LISTENERS.add(listener)
    const preference = window.matchMedia(OS_PREFERENCE)
    preference.addEventListener("change", listener)
    return () => {
        LISTENERS.delete(listener)
        preference.removeEventListener("change", listener)
    }
}

/** Paint the theme as the one class (and colour scheme) Grammar's token layer answers to. */
const paintTheme = (theme: PaintedTheme): void => {
    const root = document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(theme)
    root.style.colorScheme = theme
}

/**
 * The two reader-facing utilities every app chrome offers - flip the theme, switch the language - drawn
 * as grammar `TextAction` commands (`onPress`), never as links: neither is a destination. The theme is the
 * reader's browser preference, kept in the host-scoped `northwind-theme` cookie (so a choice made on the
 * landing site is the one the shop opens with, the way the locale travels) and following the OS until a
 * choice is made. The language switch goes through the created-navigation router, so the current path is
 * re-prefixed rather than the reader being dropped onto another page. Every word arrives resolved in `props`.
 */
export const DisplayControls = (props: DisplayControlsProps) => {
    const pathname = navigation.usePathname()
    const router = navigation.useRouter()
    const theme = useSyncExternalStore(subscribeTheme, paintedTheme, (): PaintedTheme => "light")

    useEffect(() => paintTheme(theme), [theme])

    const nextLocale = LOCALES.find((one) => one !== props.locale) ?? LOCALES[0]

    return (
        <span className={DISPLAY_CONTROLS_FRAME_CLASS_NAME} aria-label={props.label}>
            <TextAction appearance="muted" onPress={() => chooseTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? props.toLight : props.toDark}
            </TextAction>
            <TextAction appearance="muted" onPress={() => router.replace(pathname, { locale: nextLocale })}>
                {props.localeNames[nextLocale]}
            </TextAction>
        </span>
    )
}
