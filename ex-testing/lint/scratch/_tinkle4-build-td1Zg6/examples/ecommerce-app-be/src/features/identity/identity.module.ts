import {
    Module 
} from "@nestjs/common"
import {
    SessionController 
} from "./transport/http/session.controller"
import {
    HealthController 
} from "./transport/http/health.controller"

@Module({
    controllers: [SessionController,
        HealthController],
})
/**
 * The identity feature - the HTTP transport of the deployable at apps/identity that stays HTTP
 * for a sanctioned reason: the internal session surface order verifies against (a
 * machine-to-machine door) and /health (a probe). The user-facing JSON API - register, signIn,
 * account - now lives in the canonical GraphQL transport under features/identity/graphql. Thin
 * on purpose and import-free: the capability modules (account, session, the order integration)
 * and the platform modules (config, Postgres, Redis) are all registered app-wide at the
 * `apps/identity` composition root, so this module only mounts controllers - a feature never
 * imports a capability module.
 */
export class IdentityModule {}
