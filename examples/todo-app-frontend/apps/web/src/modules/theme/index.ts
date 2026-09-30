/**
 * The reader's theme preference, kept outside React so any component can read and change it.
 *
 * The three choices are `light`, `dark` and `system`; `system` is a standing instruction to follow
 * the OS rather than a paintable answer, so it never reaches the document root. The choice lives in
 * `localStorage`, subscribers are told when it changes, and the resolved answer is painted as the one
 * class (`light` or `dark`) both the app's `dark:` utilities and Grammar's token layer answer to.
 */

/** The reader's three theme choices. */
export type ThemeChoice = "light" | "dark" | "system"

/** A choice that can actually be painted: `system` already resolved against the OS. */
type ResolvedTheme = Exclude<ThemeChoice, "system">

const STORAGE_KEY = "theme"
const THEME_CLASSES: ReadonlyArray<ResolvedTheme> = ["light", "dark"]
const LISTENERS = new Set<() => void>()

const isThemeChoice = (value: string | null): value is ThemeChoice =>
    value === "light" || value === "dark" || value === "system"

/** The stored choice, `system` when none is stored or storage is unavailable. */
export const getThemeChoice = (): ThemeChoice => {
    if (typeof window === "undefined") return "system"
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return isThemeChoice(stored) ? stored : "system"
}

/** Persist the next choice and tell every subscriber. */
export const setThemeChoice = (choice: ThemeChoice): void => {
    window.localStorage.setItem(STORAGE_KEY, choice)
    for (const listener of LISTENERS) listener()
}

/** Subscribe to choice changes; call the returned function to unsubscribe. */
export const subscribeThemeChoice = (listener: () => void): (() => void) => {
    LISTENERS.add(listener)
    return () => LISTENERS.delete(listener)
}

/** The OS preference as a painted theme. */
export const systemTheme = (): ResolvedTheme =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"

/** Paint the resolved theme as the one class the token layers listen for. */
export const paintTheme = (theme: ResolvedTheme): void => {
    const root = document.documentElement
    root.classList.remove(...THEME_CLASSES)
    root.classList.add(theme)
    root.style.colorScheme = theme
}
