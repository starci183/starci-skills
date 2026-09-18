import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigurableModuleClass } from './upcoming-occurrences.module-definition';
import { UpcomingOccurrencesResolver } from './upcoming-occurrences.resolver';

@Module({
  imports: [CqrsModule],
  providers: [UpcomingOccurrencesResolver],
})
export class UpcomingOccurrencesSingleQueryModule extends ConfigurableModuleClass {}
