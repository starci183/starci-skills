import { Module } from '@nestjs/common';
import { PostgresModule } from '../../integrations/postgres';
import { TaskRepository } from './task.repository';

@Module({
  imports: [PostgresModule],
  providers: [TaskRepository],
  exports: [TaskRepository],
})
export class TaskModule {}
