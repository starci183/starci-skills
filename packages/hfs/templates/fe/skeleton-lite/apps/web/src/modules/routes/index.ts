/** Every internal destination the web app links to, named once. */
export const APP_ROUTES = {
    home: "/",
    authCallback: "/auth/callback",
} as const

export { safeNextPath } from "./safe-next-path"
