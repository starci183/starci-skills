import { Module } from '@nestjs/common';
import { SessionModule } from '../../modules/domain/session';
import { TaskModule } from '../../modules/domain/task';
import { PlatformEventsModule } from '../../modules/platform/events';
import { DeleteTaskUseCase } from './application/delete-task.use-case';
import { DeleteTaskController } from './transport/http/delete-task.controller';

@Module({
  imports: [SessionModule, TaskModule, PlatformEventsModule],
  controllers: [DeleteTaskController],
  providers: [DeleteTaskUseCase],
})
export class DeleteTaskModule {}
