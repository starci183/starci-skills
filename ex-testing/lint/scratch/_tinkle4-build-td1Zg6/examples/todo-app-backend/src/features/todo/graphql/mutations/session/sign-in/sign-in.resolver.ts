import {
    Args, Mutation, Resolver 
} from "@nestjs/graphql"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    SignInCommand 
} from "@modules/bussiness/session/sign-in.command"
import type {
    SignInCommandResult 
} from "@modules/bussiness/session/sign-in.command"

import {
    SignInInput 
} from "./graphql-types/input"
import {
    SignInResponse 
} from "./graphql-types/response"

/**
 * GraphQL mutation for signIn. Protocol adaptation only - the resolver dispatches the CQRS command
 * `bussiness/session` owns and projects the result; it makes no business decision itself, matching
 * `docs/backend-source-pattern.md`'s "smallest useful execution path".
 */
@Resolver()
/** The fr.login.sign-in door: email+password in, a Postgres-backed session token and personId out - the one anonymous mutation. */
export class SignInResolver {
    constructor(private readonly commandBus: CommandBus) {}

  @Mutation(() => SignInResponse,
      {
          name: "signIn",
          description: "Sign in with an email + password; returns the session token to send back as \"Authorization: Bearer <token>\".",
      })
    async signIn(@Args("input") input: SignInInput): Promise<SignInResponse> {
        const result = await this.commandBus.execute<SignInCommand, SignInCommandResult>(
            new SignInCommand({
                email: input.email, password: input.password 
            }),
        )
        return new SignInResponse(result.sessionToken,
            result.personId)
    }
}
