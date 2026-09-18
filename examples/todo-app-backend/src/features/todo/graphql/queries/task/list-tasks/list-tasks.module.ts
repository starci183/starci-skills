import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigurableModuleClass } from './list-tasks.module-definition';
import { ListTasksResolver } from './list-tasks.resolver';

@Module({
  imports: [CqrsModule],
  providers: [ListTasksResolver],
})
export class ListTasksSingleQueryModule extends ConfigurableModuleClass {}
