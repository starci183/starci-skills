import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { CommandBus } from '@nestjs/cqrs';
import { SignOutCommand, SignOutCommandResult } from '@modules/bussiness/session';
import { SignOutInput } from './graphql-types/input';
import { SignOutResponse } from './graphql-types/response';

/** GraphQL mutation for signOut. `sessionToken` still travels in the request body (as the original
 * REST `SignOutRequest` did), not as the `Authorization: Bearer <token>` header the task mutations read - sign-out is
 * ending that exact token, so it is the input rather than ambient authentication. */
@Resolver()
export class SignOutResolver {
  constructor(private readonly commandBus: CommandBus) {}

  @Mutation(() => SignOutResponse, { name: 'signOut', description: 'End a session by its token.' })
  async signOut(@Args('input') input: SignOutInput): Promise<SignOutResponse> {
    const result = await this.commandBus.execute<SignOutCommand, SignOutCommandResult>(
      new SignOutCommand({ sessionToken: input.sessionToken }),
    );
    return new SignOutResponse(result.signedOut);
  }
}
