import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigurableModuleClass } from './collaborators.module-definition';
import { CollaboratorsResolver } from './collaborators.resolver';

@Module({
  imports: [CqrsModule],
  providers: [CollaboratorsResolver],
})
export class CollaboratorsSingleQueryModule extends ConfigurableModuleClass {}
