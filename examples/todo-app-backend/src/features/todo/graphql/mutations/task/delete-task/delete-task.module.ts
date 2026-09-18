import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigurableModuleClass } from './delete-task.module-definition';
import { DeleteTaskResolver } from './delete-task.resolver';

@Module({
  imports: [CqrsModule],
  providers: [DeleteTaskResolver],
})
export class DeleteTaskSingleMutationModule extends ConfigurableModuleClass {}
