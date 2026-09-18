import { Module } from '@nestjs/common';
import { SessionModule } from '../../modules/domain/session';
import { TaskModule } from '../../modules/domain/task';
import { ReopenTaskUseCase } from './application/reopen-task.use-case';
import { ReopenTaskController } from './transport/http/reopen-task.controller';

@Module({
  imports: [SessionModule, TaskModule],
  controllers: [ReopenTaskController],
  providers: [ReopenTaskUseCase],
})
export class ReopenTaskModule {}
