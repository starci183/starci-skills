import { Args, Context, ID, Mutation, Resolver } from '@nestjs/graphql';
import { CommandBus } from '@nestjs/cqrs';
import { DeleteTaskCommand, DeleteTaskCommandResult } from '@modules/bussiness/task';
import { SessionService } from '@modules/bussiness/session';
import { actorIdFromRequest, GraphqlRequestLike } from '../../../session-actor.adapter';
import { DeleteTaskResponse } from './graphql-types/response';

@Resolver()
export class DeleteTaskResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
  ) {}

  @Mutation(() => DeleteTaskResponse, { name: 'deleteTask', description: 'Delete a task permanently.' })
  async deleteTask(
    @Context('req') req: GraphqlRequestLike,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<DeleteTaskResponse> {
    const actorId = await actorIdFromRequest(req, this.sessionService);
    const result = await this.commandBus.execute<DeleteTaskCommand, DeleteTaskCommandResult>(
      new DeleteTaskCommand({ actorId, taskId: id }),
    );
    return new DeleteTaskResponse(result.deleted);
  }
}
