import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigurableModuleClass } from './export-my-data.module-definition';
import { ExportMyDataResolver } from './export-my-data.resolver';

@Module({
  imports: [CqrsModule],
  providers: [ExportMyDataResolver],
})
export class ExportMyDataSingleQueryModule extends ConfigurableModuleClass {}
