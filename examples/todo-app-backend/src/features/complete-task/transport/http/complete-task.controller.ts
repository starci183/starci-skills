import { Controller, HttpException, HttpStatus, Headers, Param, Post } from '@nestjs/common';
import { SessionRepository } from '../../../../modules/domain/session';
import { AbstractException } from '../../../../modules/platform/errors';
import { CompleteTaskUseCase } from '../../application/complete-task.use-case';
import { CompleteTaskResponse } from './dto/complete-task.response';

@Controller('tasks')
export class CompleteTaskController {
  constructor(
    private readonly completeTaskUseCase: CompleteTaskUseCase,
    private readonly sessionRepository: SessionRepository,
  ) {}

  @Post(':id/complete')
  async complete(
    @Headers('x-session-token') sessionToken: string,
    @Param('id') taskId: string,
  ): Promise<CompleteTaskResponse> {
    try {
      const session = this.sessionRepository.findActive(sessionToken);
      const result = await this.completeTaskUseCase.execute({ actorId: session.personId, taskId });
      return new CompleteTaskResponse(result.taskId, result.complete);
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
