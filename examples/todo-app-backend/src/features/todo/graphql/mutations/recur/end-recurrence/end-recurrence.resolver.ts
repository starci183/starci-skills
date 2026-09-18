import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { CommandBus } from '@nestjs/cqrs';
import { EndRecurrenceCommand, EndRecurrenceCommandResult } from '@modules/bussiness/recur';
import { SessionService } from '@modules/bussiness/session';
import { actorIdFromRequest, GraphqlRequestLike } from '../../../session-actor.adapter';
import { EndRecurrenceInput } from './graphql-types/input';
import { EndRecurrenceResponse } from './graphql-types/response';

@Resolver()
export class EndRecurrenceResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
  ) {}

  @Mutation(() => EndRecurrenceResponse, {
    name: 'endRecurrence',
    description: 'fr.recur.end-rule: stop a rule the caller owns from generating any occurrence dated after the given day.',
  })
  async endRecurrence(
    @Context('req') req: GraphqlRequestLike,
    @Args('input') input: EndRecurrenceInput,
  ): Promise<EndRecurrenceResponse> {
    const actorId = await actorIdFromRequest(req, this.sessionService);
    const result = await this.commandBus.execute<EndRecurrenceCommand, EndRecurrenceCommandResult>(
      new EndRecurrenceCommand({ ruleId: input.ruleId, actorId, endedAt: input.endedAt }),
    );
    return new EndRecurrenceResponse(result.ruleId, result.endedAt, result.orphanedCount);
  }
}
