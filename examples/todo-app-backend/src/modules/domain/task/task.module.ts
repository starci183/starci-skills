import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresModule, TaskEntity } from '../../integrations/postgres';
import { TaskRepository } from './task.repository';

@Module({
  imports: [PostgresModule, TypeOrmModule.forFeature([TaskEntity])],
  providers: [TaskRepository],
  exports: [TaskRepository],
})
export class TaskModule {}
