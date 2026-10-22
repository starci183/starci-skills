import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { IdentityApiClient } from "./identity-api.client"
import { IDENTITY_API } from "./identity-api.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./identity-api.module-definition"

@Module({})
/** Provides the identity api client. */
export class IdentityApiModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that calls the identity service. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: IDENTITY_API, useClass: IdentityApiClient }],
            exports: [IDENTITY_API],
        }
    }
}
