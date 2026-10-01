import { useState } from "react"
import { useLocaleRouter } from "@/hooks/navigation"
import { signIn, SIGN_IN_REFUSAL_MESSAGE } from "@/modules/auth"
import { ROUTES } from "@/modules/routes"
import { setToken } from "@/modules/session"

/**
 * ui.login.sign-in: drives the working/refused states around the one sign-in call, and - once the
 * call actually succeeds - the one place `fr.login.sign-in`'s "lands on their list" is real: a
 * successful sign-in navigates to `/tasks`. This lives here rather than in `app/sign-in/page.tsx` (the
 * route adapter, which FE_ROUTE_CLIENT_HOOK keeps free of `useRouter`/`usePathname`/etc.) or in the
 * pure sign-in view, which only renders the four ui.login.sign-in states and never decides where
 * the app goes next.
 *
 * `refusal` is the message the refusal arrived with; `credentialsRefused` says it is the transport's one
 * collapsed "email and password do not match" sentence, which the caller's dictionary translates.
 */
export const useSignIn = () => {
    const [state, setState] = useState<{ readonly submitting: boolean; readonly refusal: string | null }>({
        submitting: false,
        refusal: null,
    })
    const router = useLocaleRouter()

    const submit = async (email: string, password: string): Promise<void> => {
        setState({ submitting: true, refusal: null })
        try {
            const result = await signIn(email, password)
            setToken(result.token)
            setState({ submitting: false, refusal: null })
            router.push(ROUTES.tasks)
        } catch (error) {
            setState({ submitting: false, refusal: error instanceof Error ? error.message : SIGN_IN_REFUSAL_MESSAGE })
        }
    }

    return { ...state, credentialsRefused: state.refusal === SIGN_IN_REFUSAL_MESSAGE, submit }
}
