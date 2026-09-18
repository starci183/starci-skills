import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigurableModuleClass } from './accept-invitation.module-definition';
import { AcceptInvitationResolver } from './accept-invitation.resolver';

@Module({
  imports: [CqrsModule],
  providers: [AcceptInvitationResolver],
})
export class AcceptInvitationSingleMutationModule extends ConfigurableModuleClass {}
