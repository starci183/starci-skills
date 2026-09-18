export interface SignOutParams {
  readonly sessionToken: string;
}

export interface SignOutResult {
  readonly signedOut: boolean;
}
