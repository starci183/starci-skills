import type { DynamicModule } from "@nestjs/common"
import { accountEntities, accountMigrations } from "@modules/domain/account"
import { CacheModule } from "@modules/integrations/cache"
import { IDENTITY_CONNECTION, DatabaseModule } from "@modules/platform/database"
import { HttpModule } from "@modules/platform/http"
import { HttpSecurityModule } from "@modules/platform/http-security"
import type { IdentityAppOptions } from "../identity.options"

/** Registers identity's edge security, persistence and outbound HTTP capabilities. */
export function platformModules(options: IdentityAppOptions): Array<DynamicModule> {
    return [
        HttpSecurityModule.register({ isGlobal: true, ...options.httpSecurity }),
        DatabaseModule.register({
            isGlobal: true,
            connections: [
                {
                    ...options.database,
                    name: IDENTITY_CONNECTION,
                    entities: accountEntities,
                    migrations: accountMigrations,
                },
            ],
        }),
        CacheModule.register({ isGlobal: true, ...options.cache }),
        HttpModule.register({ isGlobal: true }),
    ]
}
