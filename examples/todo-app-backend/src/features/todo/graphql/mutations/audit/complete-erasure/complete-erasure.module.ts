import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigurableModuleClass } from './complete-erasure.module-definition';
import { CompleteErasureResolver } from './complete-erasure.resolver';

@Module({
  imports: [CqrsModule],
  providers: [CompleteErasureResolver],
})
export class CompleteErasureSingleMutationModule extends ConfigurableModuleClass {}
