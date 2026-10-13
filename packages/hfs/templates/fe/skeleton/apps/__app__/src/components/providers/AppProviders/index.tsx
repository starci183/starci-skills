"use client"

import { ToastProvider } from "@heroui/react"
import { ThemeProvider } from "next-themes"
import type { ReactNode } from "react"
import { SWRConfig } from "swr"
import { useAuthSessionEffect } from "@/hooks/effects"
import { SwrSideEffects } from "@/hooks/swr"
import { ReduxProvider } from "@/redux"

/** What the app providers wrap: the routed tree. */
type AppProvidersProps = { readonly children: ReactNode }

/**
 * The SWR defaults of the app: no refetch on focus or reconnect (a hook that needs fresh data opts in with its own
 * refreshInterval), duplicate requests collapsed for a minute, at most two retries of a failing key, and no stale data
 * across a key change (the loading state shows instead).
 */
const SWR_DEFAULTS = {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60_000,
    errorRetryCount: 2,
    keepPreviousData: false,
} as const

/** The app-wide session effect: modules/auth's session kept in redux. Renders nothing. */
const AuthSessionEffect = () => {
    useAuthSessionEffect()
    return null
}

/**
 * The one client provider stack the locale layout mounts, outer to inner: the theme (light and dark through the `.light` /
 * `.dark` class the grammar and the brand layer read, the system theme by default), the redux store, the SWR defaults, the
 * app-wide effects and the HeroUI toast region modules/toast writes to. Each part is composed here, in its one owner.
 */
export const AppProviders = (props: AppProvidersProps) => (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <ReduxProvider>
            <SWRConfig value={SWR_DEFAULTS}>
                <AuthSessionEffect />
                <SwrSideEffects />
                {props.children}
                <ToastProvider />
            </SWRConfig>
        </ReduxProvider>
    </ThemeProvider>
)
