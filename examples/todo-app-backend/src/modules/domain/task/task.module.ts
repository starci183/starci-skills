import { Module } from '@nestjs/common';
import { TaskRepository } from './task.repository';

@Module({
  providers: [TaskRepository],
  exports: [TaskRepository],
})
export class TaskModule {}
