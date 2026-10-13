"use client"

import { ToastProvider } from "@heroui/react"
import type { ReactNode } from "react"
import { SwrProvider } from "@/components/providers/SwrProvider"
import { ThemeProvider } from "@/components/providers/ThemeProvider"
import { useAuthSessionEffect } from "@/hooks/effects"
import { SwrSideEffects } from "@/hooks/swr"
import { ReduxProvider } from "@/redux"

/** The app-wide effects: the session kept in redux and the app-wide SWR queries. Renders nothing of its own. */
const AppEffects = () => {
    useAuthSessionEffect()
    return <SwrSideEffects />
}

/**
 * The client providers the locale layout mounts once, outer to inner: the theme, the redux store, the SWR defaults, the
 * app-wide effects and the HeroUI toast region modules/toast writes to.
 */
export const AppProviders = (props: { readonly children: ReactNode }) => (
    <ThemeProvider>
        <ReduxProvider>
            <SwrProvider>
                <AppEffects />
                {props.children}
                <ToastProvider />
            </SwrProvider>
        </ReduxProvider>
    </ThemeProvider>
)
