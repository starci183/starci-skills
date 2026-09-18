import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigurableModuleClass } from './task-counts.module-definition';
import { TaskCountsResolver } from './task-counts.resolver';

@Module({
  imports: [CqrsModule],
  providers: [TaskCountsResolver],
})
export class TaskCountsSingleQueryModule extends ConfigurableModuleClass {}
