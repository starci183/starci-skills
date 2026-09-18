import { Controller, Get, HttpException, HttpStatus, Headers } from '@nestjs/common';
import { SessionRepository } from '../../../../modules/domain/session';
import { AbstractException } from '../../../../modules/platform/errors';
import { ListTasksUseCase } from '../../application/list-tasks.use-case';
import { ListTasksResponse, TaskSummaryResponse } from './dto/list-tasks.response';

@Controller('tasks')
export class ListTasksController {
  constructor(
    private readonly listTasksUseCase: ListTasksUseCase,
    private readonly sessionRepository: SessionRepository,
  ) {}

  @Get()
  async list(@Headers('x-session-token') sessionToken: string): Promise<ListTasksResponse> {
    try {
      const session = await this.sessionRepository.findActive(sessionToken);
      const result = await this.listTasksUseCase.execute({ ownerId: session.personId });
      return new ListTasksResponse(
        result.tasks.map(task => new TaskSummaryResponse(task.taskId, task.title, task.complete)),
      );
    } catch (error) {
      throw toHttpException(error);
    }
  }
}

function toHttpException(error: unknown): HttpException {
  if (error instanceof AbstractException) {
    return new HttpException(error.message, HttpStatus.UNAUTHORIZED);
  }
  return new HttpException('Unexpected error', HttpStatus.INTERNAL_SERVER_ERROR);
}
