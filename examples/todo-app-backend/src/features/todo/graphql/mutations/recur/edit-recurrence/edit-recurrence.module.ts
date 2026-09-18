import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigurableModuleClass } from './edit-recurrence.module-definition';
import { EditRecurrenceResolver } from './edit-recurrence.resolver';

@Module({
  imports: [CqrsModule],
  providers: [EditRecurrenceResolver],
})
export class EditRecurrenceSingleMutationModule extends ConfigurableModuleClass {}
