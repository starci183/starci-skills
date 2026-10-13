import type { AuthClient, AuthOutcome } from "./contracts"

/** The answer of every call until the app wires its identity provider. */
const NOT_CONFIGURED: AuthOutcome = { kind: "unavailable", code: "AUTH_PROVIDER_NOT_CONFIGURED" }

/**
 * The identity-provider client of a full app: a stub with the interface every edition shares, answering "no session" until
 * the app wires its IdP (OIDC with PKCE in the browser). Replace the bodies, never the interface: the Apollo links, the
 * session effect and the sign-in surfaces read only AuthClient.
 */
export const authClient: AuthClient = {
    session: () => Promise.resolve(undefined),
    accessToken: () => Promise.resolve(undefined),
    refreshAccessToken: () => Promise.resolve(undefined),
    signInWithPassword: () => Promise.resolve(NOT_CONFIGURED),
    signOut: () => Promise.resolve({ kind: "ok" }),
    onChange: (listener) => {
        listener(undefined)
        return () => undefined
    },
}
