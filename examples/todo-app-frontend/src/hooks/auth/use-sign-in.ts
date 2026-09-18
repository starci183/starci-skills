import { useState } from 'react';
import { signIn as requestSignIn } from '@/modules/api/auth';
import { setToken } from '@/modules/session';

export interface SignInState {
  readonly submitting: boolean;
  readonly refusal: string | null;
}

export interface UseSignIn extends SignInState {
  readonly submit: (email: string, password: string) => Promise<void>;
}

/** ui.login.sign-in: drives the working/refused states around the one sign-in call. */
export function useSignIn(): UseSignIn {
  const [state, setState] = useState<SignInState>({ submitting: false, refusal: null });

  const submit = async (email: string, password: string) => {
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
}
