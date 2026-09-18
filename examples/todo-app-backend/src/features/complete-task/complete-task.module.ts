import { Module } from '@nestjs/common';
import { SessionModule } from '../../modules/domain/session';
import { TaskModule } from '../../modules/domain/task';
import { PlatformEventsModule } from '../../modules/platform/events';
import { CompleteTaskUseCase } from './application/complete-task.use-case';
import { CompleteTaskController } from './transport/http/complete-task.controller';

@Module({
  imports: [SessionModule, TaskModule, PlatformEventsModule],
  controllers: [CompleteTaskController],
  providers: [CompleteTaskUseCase],
})
export class CompleteTaskModule {}
