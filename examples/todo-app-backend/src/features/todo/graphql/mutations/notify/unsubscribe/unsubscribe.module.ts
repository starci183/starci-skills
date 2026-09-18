import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigurableModuleClass } from './unsubscribe.module-definition';
import { UnsubscribeResolver } from './unsubscribe.resolver';

@Module({
  imports: [CqrsModule],
  providers: [UnsubscribeResolver],
})
export class UnsubscribeSingleMutationModule extends ConfigurableModuleClass {}
