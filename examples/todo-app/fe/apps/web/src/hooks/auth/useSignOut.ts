import { useLocaleRouter } from "@/hooks/navigation"
import { signOut } from "@/modules/auth"
import { ROUTES } from "@/modules/routes"
import { clearToken } from "@/modules/session"
import { useSessionToken } from "./useSessionToken"

/**
 * The one sign-out action every workspace shell's "Sign out" destination runs: drops the session token
 * (which also disables every session-gated SWR key), ends the remote session best-effort - the local
 * session is cleared either way, so a network failure never traps the reader signed in - and lands the
 * person back on the sign-in route, the mirror of useSignIn's successful navigation to `/tasks`.
 */
export const useSignOut = () => {
    const router = useLocaleRouter()
    const token = useSessionToken()
    return () => {
        clearToken()
        if (token) void signOut(token)
        router.push(ROUTES.signIn)
    }
}
