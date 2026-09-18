import { Module } from '@nestjs/common';
import { SessionModule } from '../../modules/domain/session';
import { KeycloakModule } from '../../modules/integrations/keycloak';
import { SignOutUseCase } from './application/sign-out.use-case';
import { SignOutController } from './transport/http/sign-out.controller';

@Module({
  imports: [SessionModule, KeycloakModule],
  controllers: [SignOutController],
  providers: [SignOutUseCase],
})
export class SignOutModule {}
