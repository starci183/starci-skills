import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigurableModuleClass } from './invite.module-definition';
import { InviteResolver } from './invite.resolver';

/** SessionService comes from the app-wide global SessionModule registration (see
 * create-task.module.ts's own comment) - not imported here. */
@Module({
  imports: [CqrsModule],
  providers: [InviteResolver],
})
export class InviteSingleMutationModule extends ConfigurableModuleClass {}
