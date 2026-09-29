import {
    Module 
} from "@nestjs/common"
import {
    IdentityHttpModule 
} from "./transport/http/identity-http.module"

@Module({
    imports: [IdentityHttpModule],
})
/**
 * The identity feature - the HTTP transport of the deployable at apps/identity that stays HTTP
 * for a sanctioned reason: the internal session surface order verifies against (a
 * machine-to-machine door) and /health (a probe). The user-facing JSON API - register, signIn,
 * account - now lives in the canonical GraphQL transport under features/identity/transport/graphql. Thin
 * on purpose and import-free: the capability modules (account, session, the order integration)
 * and the platform modules (config, Postgres, Redis) are all registered app-wide at the
 * `apps/identity` composition root, so this module only composes the HTTP transport, which mounts the controllers - a feature never
 * imports a capability module.
 */
export class IdentityModule {}
