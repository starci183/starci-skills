import { Module } from '@nestjs/common';
import { SessionModule } from '../../modules/domain/session';
import { KeycloakModule } from '../../modules/integrations/keycloak';
import { PlatformEventsModule } from '../../modules/platform/events';
import { SignInUseCase } from './application/sign-in.use-case';
import { SignInController } from './transport/http/sign-in.controller';

@Module({
  imports: [SessionModule, KeycloakModule, PlatformEventsModule],
  controllers: [SignInController],
  providers: [SignInUseCase],
})
export class SignInModule {}
