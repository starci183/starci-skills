import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn as requestSignIn } from "@/modules/api/auth"
import { setToken } from "@/modules/session"

/** The submitting/refusal snapshot useSignIn drives around the one sign-in call. */
export interface SignInSnapshot {
  readonly submitting: boolean;
  readonly refusal: string | null;
}

/** The public shape useSignIn returns: the current snapshot plus the one submit action. */
export interface UseSignIn extends SignInSnapshot {
  readonly submit: (email: string, password: string) => Promise<void>;
}

/**
 * ui.login.sign-in: drives the working/refused states around the one sign-in call, and - once the
 * call actually succeeds - the one place `fr.login.sign-in`'s "lands on their list" is real: a
 * successful sign-in navigates to `/tasks`. This lives here rather than in `app/sign-in/page.tsx` (the
 * route adapter, which FE_ROUTE_CLIENT_HOOK keeps free of `useRouter`/`usePathname`/etc.) or in the
 * pure `SignInFormView`, which only renders the four ui.login.sign-in states and never decides where
 * the app goes next.
 */
export const useSignIn = () => {
    const [state, setState] = useState<SignInSnapshot>({ submitting: false, refusal: null })
    const router = useRouter()

    const submit = async (email: string, password: string): Promise<void> => {
        setState({ submitting: true, refusal: null })
        try {
            const result = await requestSignIn(email, password)
            setToken(result.token)
            setState({ submitting: false, refusal: null })
            router.push("/tasks")
        } catch (error) {
            setState({ submitting: false, refusal: error instanceof Error ? error.message : "That email and password do not match." })
        }
    }

    return { ...state, submit }
}
