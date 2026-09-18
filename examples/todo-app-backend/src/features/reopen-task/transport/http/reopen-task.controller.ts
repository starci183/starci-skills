import { Controller, HttpException, HttpStatus, Headers, Param, Post } from '@nestjs/common';
import { SessionRepository } from '../../../../modules/domain/session';
import { AbstractException } from '../../../../modules/platform/errors';
import { ReopenTaskUseCase } from '../../application/reopen-task.use-case';
import { ReopenTaskResponse } from './dto/reopen-task.response';

@Controller('tasks')
export class ReopenTaskController {
  constructor(
    private readonly reopenTaskUseCase: ReopenTaskUseCase,
    private readonly sessionRepository: SessionRepository,
  ) {}

  @Post(':id/reopen')
  async reopen(
    @Headers('x-session-token') sessionToken: string,
    @Param('id') taskId: string,
  ): Promise<ReopenTaskResponse> {
    try {
      const session = await this.sessionRepository.findActive(sessionToken);
      const result = await this.reopenTaskUseCase.execute({ actorId: session.personId, taskId });
      return new ReopenTaskResponse(result.taskId, result.complete);
    } catch (error) {
      throw toHttpException(error);
    }
  }
}

function toHttpException(error: unknown): HttpException {
  if (error instanceof AbstractException) {
    const status = error.code === 'TASK_NOT_FOUND' ? HttpStatus.NOT_FOUND : HttpStatus.FORBIDDEN;
    return new HttpException(error.message, status);
  }
  return new HttpException('Unexpected error', HttpStatus.INTERNAL_SERVER_ERROR);
}
