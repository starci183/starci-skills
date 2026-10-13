"use client"

import { ToastProvider } from "@heroui/react"
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
 * The client providers the locale layout mounts once inside the locale shell (so next-intl answers the toast labels),
 * outer to inner: the redux store, the SWR defaults (inline: one provider owner imports no other), the app-wide effects and the HeroUI toast region modules/toast
 * writes to. The theme is the shared DisplayControls' own (its cookie), so no theme provider sits here.
 */
export const AppProviders = (props: AppProvidersProps) => (
    <ReduxProvider>
        <SWRConfig value={SWR_DEFAULTS}>
            <AuthSessionEffect />
            <SwrSideEffects />
            {props.children}
            <ToastProvider />
        </SWRConfig>
    </ReduxProvider>
)
