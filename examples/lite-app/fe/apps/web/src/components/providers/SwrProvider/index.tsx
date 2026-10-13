"use client"

import type { ReactNode } from "react"
import { SWRConfig } from "swr"

/**
 * The SWR defaults of the app: no refetch on focus or reconnect (a hook that needs fresh data opts in with its own
 * refreshInterval), duplicate requests collapsed for a minute, at most two retries of a failing key, and no stale data
 * across a key change (the loading state shows instead).
 */
export const SwrProvider = (props: { readonly children: ReactNode }) => (
    <SWRConfig
        value={{
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            dedupingInterval: 60_000,
            errorRetryCount: 2,
            keepPreviousData: false,
        }}
    >
        {props.children}
    </SWRConfig>
)
