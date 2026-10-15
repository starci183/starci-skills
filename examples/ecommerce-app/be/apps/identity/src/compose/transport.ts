import type { DynamicModule, Type } from "@nestjs/common"
import { HealthHttpModule } from "@features/api/health"
import { IdentityGraphqlModule } from "@features/api/identity"
import { CACHE } from "@modules/integrations/cache"
import { DatabaseProbe } from "@modules/platform/database"
import { GraphqlModule } from "@modules/platform/graphql"
import { ProbesModule } from "@modules/platform/probes"

/** Registers identity's readiness probes and API transports. */
export function transportModules(): Array<DynamicModule | Type<unknown>> {
    return [
        ProbesModule.register({ isGlobal: true, service: "identity", probes: [DatabaseProbe, CACHE] }),
        GraphqlModule.register({ isGlobal: true }),
        HealthHttpModule.register({}),
        IdentityGraphqlModule.register({}),
    ]
}
