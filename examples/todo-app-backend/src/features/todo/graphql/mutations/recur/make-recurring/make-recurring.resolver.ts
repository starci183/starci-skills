import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { CommandBus } from '@nestjs/cqrs';
import { MakeRecurringCommand, MakeRecurringCommandResult } from '@modules/bussiness/recur';
import { SessionService } from '@modules/bussiness/session';
import { actorIdFromRequest, GraphqlRequestLike } from '../../../session-actor.adapter';
import { MakeRecurringInput } from './graphql-types/input';
import { MakeRecurringResponse } from './graphql-types/response';

@Resolver()
export class MakeRecurringResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
  ) {}

  @Mutation(() => MakeRecurringResponse, {
    name: 'makeRecurring',
    description: 'fr.recur.make-recurring: create a recurrence rule owned by the caller.',
  })
  async makeRecurring(
    @Context('req') req: GraphqlRequestLike,
    @Args('input') input: MakeRecurringInput,
  ): Promise<MakeRecurringResponse> {
    const ownerId = await actorIdFromRequest(req, this.sessionService);
    const result = await this.commandBus.execute<MakeRecurringCommand, MakeRecurringCommandResult>(
      new MakeRecurringCommand({
        ownerId,
        title: input.title,
        frequency: input.frequency,
        n: input.n ?? null,
        dayOfMonth: input.dayOfMonth ?? null,
        timeZone: input.timeZone,
        time: input.time,
        startDate: input.startDate,
      }),
    );
    return new MakeRecurringResponse(result.ruleId, result.title, result.frequency, result.timeZone, result.time, result.startDate);
  }
}
