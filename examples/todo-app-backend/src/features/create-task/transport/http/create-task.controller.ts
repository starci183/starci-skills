import { Body, Controller, HttpException, HttpStatus, Headers, Post } from '@nestjs/common';
import { SessionRepository } from '../../../../modules/domain/session';
import { AbstractException } from '../../../../modules/platform/errors';
import { CreateTaskUseCase } from '../../application/create-task.use-case';
import { CreateTaskRequest } from './dto/create-task.request';
import { CreateTaskResponse } from './dto/create-task.response';

@Controller('tasks')
export class CreateTaskController {
  constructor(
    private readonly createTaskUseCase: CreateTaskUseCase,
    private readonly sessionRepository: SessionRepository,
  ) {}

  @Post()
  async create(
    @Headers('x-session-token') sessionToken: string,
    @Body() request: CreateTaskRequest,
  ): Promise<CreateTaskResponse> {
    try {
      const session = this.sessionRepository.findActive(sessionToken);
      const result = await this.createTaskUseCase.execute({ ownerId: session.personId, title: request.title });
      return new CreateTaskResponse(result.taskId, result.title);
    } catch (error) {
      throw toHttpException(error);
    }
  }
}

function toHttpException(error: unknown): HttpException {
  if (error instanceof AbstractException) {
    const status = error.code === 'TASK_TITLE_REQUIRED' ? HttpStatus.BAD_REQUEST : HttpStatus.UNAUTHORIZED;
    return new HttpException(error.message, status);
  }
  return new HttpException('Unexpected error', HttpStatus.INTERNAL_SERVER_ERROR);
}
