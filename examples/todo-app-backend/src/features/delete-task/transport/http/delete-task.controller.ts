import { Controller, Delete, HttpException, HttpStatus, Headers, Param } from '@nestjs/common';
import { SessionRepository } from '../../../../modules/domain/session';
import { AbstractException } from '../../../../modules/platform/errors';
import { DeleteTaskUseCase } from '../../application/delete-task.use-case';
import { DeleteTaskResponse } from './dto/delete-task.response';

@Controller('tasks')
export class DeleteTaskController {
  constructor(
    private readonly deleteTaskUseCase: DeleteTaskUseCase,
    private readonly sessionRepository: SessionRepository,
  ) {}

  @Delete(':id')
  async delete(
    @Headers('x-session-token') sessionToken: string,
    @Param('id') taskId: string,
  ): Promise<DeleteTaskResponse> {
    try {
      const session = await this.sessionRepository.findActive(sessionToken);
      const result = await this.deleteTaskUseCase.execute({ actorId: session.personId, taskId });
      return new DeleteTaskResponse(result.deleted);
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
