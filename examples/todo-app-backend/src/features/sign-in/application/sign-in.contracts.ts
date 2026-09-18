export interface SignInParams {
  readonly email: string;
  readonly password: string;
}

export interface SignInResult {
  readonly sessionToken: string;
  readonly personId: string;
}
