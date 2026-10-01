import { useSyncExternalStore } from "react"

/** The page never changes the answer after it has mounted, so there is nothing to subscribe to. */
const subscribeNever = () => () => undefined

/**
 * False on the server and in the client's first render, true once the client has mounted. Anything that only
 * the browser can answer (the device's time zone, the stored session) waits for it, so the server render
 * and the first client render agree and hydration never mismatches.
 */
export const useHydrated = (): boolean =>
    useSyncExternalStore(
        subscribeNever,
        () => true,
        () => false,
    )
