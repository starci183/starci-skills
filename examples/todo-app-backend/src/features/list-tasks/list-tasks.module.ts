import { Module } from '@nestjs/common';
import { SessionModule } from '../../modules/domain/session';
import { TaskModule } from '../../modules/domain/task';
import { ListTasksUseCase } from './application/list-tasks.use-case';
import { ListTasksController } from './transport/http/list-tasks.controller';

@Module({
  imports: [SessionModule, TaskModule],
  controllers: [ListTasksController],
  providers: [ListTasksUseCase],
})
export class ListTasksModule {}
