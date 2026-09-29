import {
    Args, Mutation, Resolver 
} from "@nestjs/graphql"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    SignOutCommand,
} from "@modules/domain/session/index"
import type {
    SignOutCommandResult,
} from "@modules/domain/session/index"

import {
    SignOutInput 
} from "./graphql-types/input"
import {
    SignOutResponse 
} from "./graphql-types/response"
import {
    TODO_MESSAGES 
} from "../../../../../messages/index"

/** GraphQL mutation for signOut. `sessionToken` still travels in the request body (as the original
 * REST `SignOutRequest` did), not as the `Authorization: Bearer <token>` header the task mutations read - sign-out is
 * ending that exact token, so it is the input rather than ambient authentication. */
@Resolver()
/** The fr.login.sign-out door: destroys the presented session row so the token stops resolving to an actor. */
export class SignOutResolver {
    constructor(private readonly commandBus: CommandBus) {}

  @Mutation(() => SignOutResponse,
      {
          name: "signOut", description: TODO_MESSAGES.get("signOut.description") 
      })
    async signOut(@Args("request") input: SignOutInput): Promise<SignOutResponse> {
        const result = await this.commandBus.execute<SignOutCommand, SignOutCommandResult>(
            new SignOutCommand({
                sessionToken: input.sessionToken 
            }),
        )
        return new SignOutResponse(result.signedOut)
    }
}
