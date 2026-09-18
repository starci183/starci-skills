export interface SignInCommandParams {
  readonly email: string;
  readonly password: string;
}

export interface SignInCommandResult {
  readonly sessionToken: string;
  readonly personId: string;
}

/** br.login.password.sign-in as a CQRS write, dispatched by the GraphQL signIn mutation resolver. */
export class SignInCommand {
  constructor(readonly params: SignInCommandParams) {}
}
