import { useState } from 'react';
import { signIn as requestSignIn } from '@/modules/api/auth';
import { setToken } from '@/modules/session';

/** The submitting/refusal snapshot useSignIn drives around the one sign-in call. */
export interface SignInSnapshot {
  readonly submitting: boolean;
  readonly refusal: string | null;
}

/** The public shape useSignIn returns: the current snapshot plus the one submit action. */
export interface UseSignIn extends SignInSnapshot {
  readonly submit: (email: string, password: string) => Promise<void>;
}

/** ui.login.sign-in: drives the working/refused states around the one sign-in call. */
export const useSignIn = () => {
  const [state, setState] = useState<SignInSnapshot>({ submitting: false, refusal: null });

  const submit = async (email: string, password: string): Promise<void> => {
    setState({ submitting: true, refusal: null });
    try {
      const result = await requestSignIn(email, password);
      setToken(result.token);
      setState({ submitting: false, refusal: null });
    } catch (error) {
      setState({ submitting: false, refusal: error instanceof Error ? error.message : 'That email and password do not match.' });
    }
  };

  return { ...state, submit };
};
