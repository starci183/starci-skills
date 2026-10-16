import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_FILTER, APP_GUARD } from "@nestjs/core"
import { AuthGuard, CredentialGuard } from "@modules/domain/identity"
import { ErrorsFilter } from "@modules/platform/errors"
import { OriginGuard, RateLimitGuard } from "@modules/platform/http-security"
import type { BillingAppOptions } from "./billing.options"
import { doorsModules } from "./compose/doors"
import { invoicingModules } from "./compose/invoicing"
import { persistenceModules } from "./compose/persistence"
import { platformModules } from "./compose/platform"

@Module({})
/**
 * The composition root of the billing api: the invoice and payment capabilities over the billing database, the consumer of the
 * order events, the signed webhook door of the bank transfer notifier and the readiness probe. It serves no authenticated
 * operation, but the four guards run in the fixed order like in every api, so a door that is not declared open is denied.
 */
export class AppModule {
    /** Builds the billing api from its parsed options. */
    static register(options: BillingAppOptions): DynamicModule {
        return {
            module: AppModule,
            imports: [
                ...platformModules(options),
                ...persistenceModules(options),
                ...invoicingModules(options),
                ...doorsModules(),
            ],
            providers: [
                { provide: APP_FILTER, useClass: ErrorsFilter },
                { provide: APP_GUARD, useClass: RateLimitGuard },
                { provide: APP_GUARD, useClass: OriginGuard },
                { provide: APP_GUARD, useClass: CredentialGuard },
                { provide: APP_GUARD, useClass: AuthGuard },
            ],
        }
    }
}
