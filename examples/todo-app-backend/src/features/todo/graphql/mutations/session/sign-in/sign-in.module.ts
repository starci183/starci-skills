import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigurableModuleClass } from './sign-in.module-definition';
import { SignInResolver } from './sign-in.resolver';

/** Module for the signIn mutation. Depends only on CqrsModule to reach the CommandBus - the actual
 * sign-in orchestration lives in `bussiness/session`, composed by the app once, not from here. */
@Module({
  imports: [CqrsModule],
  providers: [SignInResolver],
})
export class SignInSingleMutationModule extends ConfigurableModuleClass {}
