/** Contract naming the sign in command params shape bussiness/session code and its consumers share; a second site never retypes it inline. */
export interface SignInCommandParams {
  readonly email: string;
  readonly password: string;
}

/** Contract naming the sign in command result shape bussiness/session code and its consumers share; a second site never retypes it inline. */
export interface SignInCommandResult {
  readonly sessionToken: string;
  readonly personId: string;
}

/** br.login.password.sign-in as a CQRS write, dispatched by the GraphQL signIn mutation resolver. */
export class SignInCommand {
    constructor(readonly params: SignInCommandParams) {}
}
