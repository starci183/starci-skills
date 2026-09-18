import { Module } from '@nestjs/common';
import { ConfigModule } from '../../platform/config';
import { KeycloakClient } from './keycloak.client';

@Module({
  imports: [ConfigModule],
  providers: [KeycloakClient],
  exports: [KeycloakClient],
})
export class KeycloakModule {}
