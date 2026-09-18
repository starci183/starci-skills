import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '../../platform/config';
import { ConfigurableModuleClass, OPTIONS_TYPE } from './keycloak.module-definition';
import { KeycloakClient } from './keycloak.client';

/** integration.login.keycloak: the one Keycloak client, registered the way nivo registers every
 * capability - `register()` returning a DynamicModule built on the shared isGlobal module-definition. */
@Module({})
export class KeycloakModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE = {}): DynamicModule {
    const base = super.register(options);
    return {
      ...base,
      imports: [ConfigModule],
      providers: [...(base.providers ?? []), KeycloakClient],
      exports: [KeycloakClient],
    };
  }
}
