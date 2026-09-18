import { Module } from '@nestjs/common';
import { SessionModule } from '../../modules/domain/session';
import { KeycloakModule } from '../../modules/integrations/keycloak';
import { SignInUseCase } from './application/sign-in.use-case';
import { SignInController } from './transport/http/sign-in.controller';

@Module({
  imports: [SessionModule, KeycloakModule],
  controllers: [SignInController],
  providers: [SignInUseCase],
})
export class SignInModule {}
