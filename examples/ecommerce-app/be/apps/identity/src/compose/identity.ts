import type { DynamicModule } from "@nestjs/common"
import { AccountModule } from "@modules/domain/account"
import { IdentityModule } from "@modules/domain/identity"
import { SessionModule, SessionService } from "@modules/domain/session"
import { KeycloakModule } from "@modules/integrations/keycloak"
import { KeycloakAdminModule } from "@modules/integrations/keycloak-admin"
import { OrderApiModule } from "@modules/integrations/order-api"
import type { IdentityAppOptions } from "../identity.options"

/** Registers identity integrations and the account, session and authentication domains. */
export function identityModules(options: IdentityAppOptions): Array<DynamicModule> {
    return [
        KeycloakModule.register({ isGlobal: true, ...options.keycloak }),
        KeycloakAdminModule.register({ isGlobal: true, ...options.keycloakAdmin }),
        OrderApiModule.register({ isGlobal: true, ...options.orderApi }),
        AccountModule.register({ isGlobal: true }),
        SessionModule.register({ isGlobal: true }),
        IdentityModule.register({ isGlobal: true, verifier: SessionService }),
    ]
}
