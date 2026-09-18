import { Module } from '@nestjs/common';
import { SessionModule } from '../../modules/domain/session';
import { KeycloakModule } from '../../modules/integrations/keycloak';
import { PlatformEventsModule } from '../../modules/platform/events';
import { SignOutUseCase } from './application/sign-out.use-case';
import { SignOutController } from './transport/http/sign-out.controller';

@Module({
  imports: [SessionModule, KeycloakModule, PlatformEventsModule],
  controllers: [SignOutController],
  providers: [SignOutUseCase],
})
export class SignOutModule {}
