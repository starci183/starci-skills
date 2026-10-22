"use client"

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react"

/**
 * The reader's three theme choices. `system` is a standing instruction to follow the OS rather
 * than a paintable answer, so it never reaches the document root.
 */
export type ThemeChoice = "light" | "dark" | "system";

/** A choice that can actually be painted: `system` already resolved against the OS. */
export type ResolvedTheme = Exclude<ThemeChoice, "system">;

/**
 * What the provider hands the tree: the chosen preference, the painted answer once hydration
 * has read storage, and the setter that persists the next choice.
 */
export type ThemeContextValue = {
  readonly theme: ThemeChoice;
  readonly resolvedTheme?: ResolvedTheme | undefined;
  readonly setTheme: (theme: ThemeChoice) => void;
};

const STORAGE_KEY = "theme"
const THEME_CLASSES: ReadonlyArray<ResolvedTheme> = ["light", "dark"]

const ThemeContext = createContext<ThemeContextValue>({
    theme: "system",
    resolvedTheme: undefined,
    setTheme: () => undefined,
})

const isThemeChoice = (value: string | null): value is ThemeChoice =>
    value === "light" || value === "dark" || value === "system"

const systemTheme = (): ResolvedTheme =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"

/** Paint the resolved theme as the one class both the app's `dark:` utilities and token layers answer to. */
const paintTheme = (theme: ResolvedTheme) => {
    const root = document.documentElement
    root.classList.remove(...THEME_CLASSES)
    root.classList.add(theme)
    root.style.colorScheme = theme
}

const storedListeners = new Set<() => void>()

const subscribeStored = (notify: () => void) => {
    storedListeners.add(notify)
    window.addEventListener("storage", notify)
    return () => {
        storedListeners.delete(notify)
        window.removeEventListener("storage", notify)
    }
}

const readStored = (): ThemeChoice => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return isThemeChoice(stored) ? stored : "system"
}

const serverStored = (): ThemeChoice => "system"

const subscribeSystem = (notify: () => void) => {
    const preference = window.matchMedia("(prefers-color-scheme: dark)")
    preference.addEventListener("change", notify)
    return () => preference.removeEventListener("change", notify)
}

const serverSystem = (): ResolvedTheme | undefined => undefined

const persistTheme = (nextTheme: ThemeChoice) => {
    window.localStorage.setItem(STORAGE_KEY, nextTheme)
    for (const notify of storedListeners) notify()
}

/** The routed application tree whose theme preference remains stable across navigation. */
export type ThemeProviderProps = {
  readonly children: ReactNode;
};

/**
 * Persist and resolve the product's light/dark preference without rendering executable markup.
 *
 * `next-themes` injected a literal `<script>` from a client component. React 19 correctly reports
 * that such a script is inert during client rendering, and Next's development overlay turns the
 * report into a visible product issue - which is why this provider is hand-rolled instead. Its
 * whole job: read the stored choice (an external store, so hydration reads the server's answer first), follow the OS while `system` is selected,
 * and paint the one class the token layers listen for.
 */
export const ThemeProvider = (props: ThemeProviderProps) => {
    const theme = useSyncExternalStore(subscribeStored, readStored, serverStored)
    const system = useSyncExternalStore<ResolvedTheme | undefined>(subscribeSystem, systemTheme, serverSystem)
    const resolvedTheme = theme === "system" ? system : theme

    useEffect(() => {
        if (resolvedTheme !== undefined) paintTheme(resolvedTheme)
    }, [resolvedTheme])

    const value = useMemo<ThemeContextValue>(() => ({ theme, resolvedTheme, setTheme: persistTheme }), [resolvedTheme, theme])

    return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>
}

/** Read and update the single persisted theme preference owned by the application shell. */
export const useTheme = (): ThemeContextValue => useContext(ThemeContext)
