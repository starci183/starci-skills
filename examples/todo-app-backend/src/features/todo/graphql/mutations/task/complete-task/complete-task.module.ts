import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigurableModuleClass } from './complete-task.module-definition';
import { CompleteTaskResolver } from './complete-task.resolver';

/** See create-task.module.ts's comment: SessionService reaches this resolver through the app's one
 * global SessionModule registration, not through an import here. */
@Module({
  imports: [CqrsModule],
  providers: [CompleteTaskResolver],
})
export class CompleteTaskSingleMutationModule extends ConfigurableModuleClass {}
