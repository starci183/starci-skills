import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { KeycloakClient } from "./keycloak.client"
import { KEYCLOAK } from "./keycloak.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./keycloak.module-definition"

@Module({})
/** Provides the keycloak client. */
export class KeycloakModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that signs people in. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: KEYCLOAK, useClass: KeycloakClient }],
            exports: [KEYCLOAK],
        }
    }
}
