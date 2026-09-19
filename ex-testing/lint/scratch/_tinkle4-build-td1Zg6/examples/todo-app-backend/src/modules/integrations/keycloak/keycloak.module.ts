import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./keycloak.module-definition"
import {
    KeycloakClient 
} from "./keycloak.client"

/**
 * integration.login.keycloak: the one Keycloak client, registered the way nivo registers every
 * capability - `register()` returning a DynamicModule built on the shared isGlobal module-definition.
 * No `imports: [ConfigModule]` here: `ConfigModule` is registered globally from `app.module.ts`
 * (`ConfigModule.register({ isGlobal: true })`), so `AppConfigService` is already visible to
 * `KeycloakClient` without this module declaring the dependency itself.
 */
@Module({
})
/** Nest module wiring the keycloak capability's providers; the app composition root registers it - other modules never import it. */
export class KeycloakModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []),
                KeycloakClient],
            exports: [KeycloakClient],
        }
    }
}
