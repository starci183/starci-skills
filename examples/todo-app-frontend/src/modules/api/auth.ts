import { apiRequest } from './client';

/**
 * br.login.password.sign-in: a refusal must not say which half of the pair was wrong. This module
 * normalizes any refused sign-in - unknown email or wrong password alike - into the same message, so
 * the distinction never reaches a caller that could render it differently.
 */
export const SIGN_IN_REFUSAL_MESSAGE = 'That email and password do not match.';

export interface SignInResult {
  readonly token: string;
}

export async function signIn(email: string, password: string): Promise<SignInResult> {
  try {
    return await apiRequest<SignInResult>('/auth/sign-in', { method: 'POST', body: { email, password } });
  } catch (error) {
    throw new Error(SIGN_IN_REFUSAL_MESSAGE, { cause: error });
  }
}
