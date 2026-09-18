import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigurableModuleClass } from './end-recurrence.module-definition';
import { EndRecurrenceResolver } from './end-recurrence.resolver';

@Module({
  imports: [CqrsModule],
  providers: [EndRecurrenceResolver],
})
export class EndRecurrenceSingleMutationModule extends ConfigurableModuleClass {}
