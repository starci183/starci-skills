import { Args, Context, ID, Mutation, Resolver } from '@nestjs/graphql';
import { CommandBus } from '@nestjs/cqrs';
import { CompleteTaskCommand, CompleteTaskCommandResult } from '@modules/bussiness/task';
import { SessionService } from '@modules/bussiness/session';
import { actorIdFromRequest, GraphqlRequestLike } from '../../../session-actor.adapter';
import { CompleteTaskResponse } from './graphql-types/response';

@Resolver()
export class CompleteTaskResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
  ) {}

  @Mutation(() => CompleteTaskResponse, { name: 'completeTask', description: 'Mark a task complete.' })
  async completeTask(
    @Context('req') req: GraphqlRequestLike,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<CompleteTaskResponse> {
    const actorId = await actorIdFromRequest(req, this.sessionService);
    const result = await this.commandBus.execute<CompleteTaskCommand, CompleteTaskCommandResult>(
      new CompleteTaskCommand({ actorId, taskId: id }),
    );
    return new CompleteTaskResponse(result.taskId, result.complete);
  }
}
