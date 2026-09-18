import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigurableModuleClass } from './make-recurring.module-definition';
import { MakeRecurringResolver } from './make-recurring.resolver';

/** SessionService is not imported here: SessionModule is registered globally from app.module.ts (see
 * create-task.module.ts's identical comment on the same convention). */
@Module({
  imports: [CqrsModule],
  providers: [MakeRecurringResolver],
})
export class MakeRecurringSingleMutationModule extends ConfigurableModuleClass {}
