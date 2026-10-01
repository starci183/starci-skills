import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { SESSION_VERIFIER } from "./identity.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./identity.module-definition"

@Module({})
/** The identity capability: the verifier the auth guard authenticates with. The app registers AuthGuard itself, after the throttler and the origin guard. */
export class IdentityModule extends ConfigurableModuleClass {
    /** Registers the capability once per app with the provider that verifies bearer tokens there. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: SESSION_VERIFIER, useExisting: options.verifier }],
            exports: [SESSION_VERIFIER],
        }
    }
}
