/** Contract naming the sign out command params shape bussiness/session code and its consumers share; a second site never retypes it inline. */
export interface SignOutCommandParams {
  readonly sessionToken: string;
}

/** Contract naming the sign out command result shape bussiness/session code and its consumers share; a second site never retypes it inline. */
export interface SignOutCommandResult {
  readonly signedOut: boolean;
}

/** fr.login.sign-out as a CQRS write. */
export class SignOutCommand {
    constructor(readonly params: SignOutCommandParams) {}
}
