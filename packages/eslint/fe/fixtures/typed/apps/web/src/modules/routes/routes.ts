/** Fixture: static route tables, and a table whose leaf is computed. */
export const APP_ROUTES = { home: "/", login: "/login", authCallback: "/auth/callback" } as const
export const AUTH_ROUTES = { workspaces: "/workspaces", reset: "/reset-password" } as const
const compute = (): string => "/computed"
export const COMPUTED_ROUTES = { home: compute() } as const
