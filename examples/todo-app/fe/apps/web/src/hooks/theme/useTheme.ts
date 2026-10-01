import { useEffect, useSyncExternalStore } from "react"
import {
    getThemeChoice,
    paintTheme,
    setThemeChoice,
    subscribeThemeChoice,
    systemTheme,
    type ThemeChoice,
} from "@/modules/theme"

/**
 * The reader's persisted theme preference and its setter. Whenever the choice changes it paints the
 * resolved theme, and while `system` is chosen it follows the OS. The server and the first client
 * render both answer `system`, so hydration agrees; the stored choice is read right after.
 */
export const useTheme = () => {
    const theme = useSyncExternalStore(subscribeThemeChoice, getThemeChoice, (): ThemeChoice => "system")

    useEffect(() => {
        paintTheme(theme === "system" ? systemTheme() : theme)
        if (theme !== "system") return
        const preference = window.matchMedia("(prefers-color-scheme: dark)")
        const followSystem = () => paintTheme(systemTheme())
        preference.addEventListener("change", followSystem)
        return () => preference.removeEventListener("change", followSystem)
    }, [theme])

    return { theme, setTheme: setThemeChoice }
}
