import { Module } from '@nestjs/common';
import { SessionModule } from '../../modules/domain/session';
import { TaskModule } from '../../modules/domain/task';
import { PlatformEventsModule } from '../../modules/platform/events';
import { CreateTaskUseCase } from './application/create-task.use-case';
import { CreateTaskController } from './transport/http/create-task.controller';

@Module({
  imports: [SessionModule, TaskModule, PlatformEventsModule],
  controllers: [CreateTaskController],
  providers: [CreateTaskUseCase],
})
export class CreateTaskModule {}
