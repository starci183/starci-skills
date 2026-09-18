export interface SignOutCommandParams {
  readonly sessionToken: string;
}

export interface SignOutCommandResult {
  readonly signedOut: boolean;
}

/** fr.login.sign-out as a CQRS write. */
export class SignOutCommand {
  constructor(readonly params: SignOutCommandParams) {}
}
