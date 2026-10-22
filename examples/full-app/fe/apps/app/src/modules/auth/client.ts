import type { AuthClient, AuthSession, IssuedSession } from "./contracts"

/** The browser storage key of the session: the identity service's opaque bearer and the person it authenticates. */
const STORAGE_KEY = "northwind-session"

const listeners = new Set<(session: AuthSession | undefined) => void>()

/** The stored session, or undefined outside a browser, without one, or when the stored value is not a session. */
const readStored = (): IssuedSession | undefined => {
    if (typeof window === "undefined") return undefined
    try {
        const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null")
        if (typeof parsed !== "object" || parsed === null || !("sessionToken" in parsed) || !("personId" in parsed))
            return undefined
        const { sessionToken, personId } = parsed
        return typeof sessionToken === "string" && typeof personId === "string" ? { sessionToken, personId } : undefined
    } catch {
        return undefined
    }
}

/**
 * Writes (or, with undefined, removes) the stored session; answers false when the browser refuses storage (a private
 * window), where the session lives only as long as the listeners' state.
 */
const writeStored = (issued: IssuedSession | undefined): boolean => {
    try {
        if (issued === undefined) window.localStorage.removeItem(STORAGE_KEY)
        else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(issued))
        return true
    } catch {
        return false
    }
}

const notify = (session: AuthSession | undefined): void => {
    for (const listener of listeners) listener(session)
}

const end = (): void => {
    writeStored(undefined)
    notify(undefined)
}

/**
 * The shop's session client over the identity service's opaque bearer, kept in the browser's local storage. The token is
 * never decoded: the identity and order services verify it on every call.
 */
export const authClient: AuthClient = {
    session: () => {
        const stored = readStored()
        return stored === undefined ? undefined : { personId: stored.personId }
    },
    accessToken: () => Promise.resolve(readStored()?.sessionToken),
    refreshAccessToken: () => {
        end()
        return Promise.resolve(undefined)
    },
    establish: (issued) => {
        writeStored(issued)
        notify({ personId: issued.personId })
    },
    end,
    onChange: (listener) => {
        listeners.add(listener)
        return () => {
            listeners.delete(listener)
        }
    },
}
