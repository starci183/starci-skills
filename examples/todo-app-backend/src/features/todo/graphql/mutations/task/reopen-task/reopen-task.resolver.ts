import { Args, Context, ID, Mutation, Resolver } from '@nestjs/graphql';
import { CommandBus } from '@nestjs/cqrs';
import { ReopenTaskCommand, ReopenTaskCommandResult } from '@modules/bussiness/task';
import { SessionService } from '@modules/bussiness/session';
import { actorIdFromRequest, GraphqlRequestLike } from '../../../session-actor.adapter';
import { ReopenTaskResponse } from './graphql-types/response';

@Resolver()
export class ReopenTaskResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
  ) {}

  @Mutation(() => ReopenTaskResponse, { name: 'reopenTask', description: 'Reopen a completed task.' })
  async reopenTask(
    @Context('req') req: GraphqlRequestLike,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ReopenTaskResponse> {
    const actorId = await actorIdFromRequest(req, this.sessionService);
    const result = await this.commandBus.execute<ReopenTaskCommand, ReopenTaskCommandResult>(
      new ReopenTaskCommand({ actorId, taskId: id }),
    );
    return new ReopenTaskResponse(result.taskId, result.complete);
  }
}
