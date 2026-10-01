import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { KeycloakAdminClient } from "./keycloak-admin.client"
import { KEYCLOAK_ADMIN } from "./keycloak-admin.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./keycloak-admin.module-definition"
import { KeycloakAdminTokenService } from "./keycloak-admin-token.service"

@Module({})
/** Provides the keycloak admin client. */
export class KeycloakAdminModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that reads members from Keycloak. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                KeycloakAdminTokenService,
                { provide: KEYCLOAK_ADMIN, useClass: KeycloakAdminClient },
            ],
            exports: [KEYCLOAK_ADMIN],
        }
    }
}
