"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"

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
  readonly resolvedTheme?: ResolvedTheme;
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

const resolveTheme = (theme: ThemeChoice): ResolvedTheme => (theme === "system" ? systemTheme() : theme)

/** Paint the resolved theme as the one class both the app's `dark:` utilities and token layers answer to. */
const paintTheme = (theme: ResolvedTheme) => {
    const root = document.documentElement
    root.classList.remove(...THEME_CLASSES)
    root.classList.add(theme)
    root.style.colorScheme = theme
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
 * whole job: read the stored choice after hydration, follow the OS while `system` is selected,
 * and paint the one class the token layers listen for.
 */
export const ThemeProvider = (props: ThemeProviderProps) => {
    const [theme, setThemeState] = useState<ThemeChoice>("system")
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>()
    const hydrated = useRef(false)

    useEffect(() => {
        const stored = window.localStorage.getItem(STORAGE_KEY)
        const initialTheme = isThemeChoice(stored) ? stored : "system"
        const initialResolved = resolveTheme(initialTheme)
        hydrated.current = true
        setThemeState(initialTheme)
        setResolvedTheme(initialResolved)
        paintTheme(initialResolved)
    }, [])

    useEffect(() => {
        if (!hydrated.current) return
        const nextResolved = resolveTheme(theme)
        window.localStorage.setItem(STORAGE_KEY, theme)
        setResolvedTheme(nextResolved)
        paintTheme(nextResolved)
    }, [theme])

    useEffect(() => {
        if (theme !== "system") return
        const preference = window.matchMedia("(prefers-color-scheme: dark)")
        const followSystem = () => {
            const nextResolved = preference.matches ? "dark" : "light"
            setResolvedTheme(nextResolved)
            paintTheme(nextResolved)
        }
        preference.addEventListener("change", followSystem)
        return () => preference.removeEventListener("change", followSystem)
    }, [theme])

    const setTheme = useCallback((nextTheme: ThemeChoice) => setThemeState(nextTheme), [])
    const value = useMemo<ThemeContextValue>(() => ({ theme, resolvedTheme, setTheme }), [resolvedTheme, setTheme, theme])

    return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>
}

/** Read and update the single persisted theme preference owned by the application shell. */
export const useTheme = (): ThemeContextValue => useContext(ThemeContext)
