import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AuthGuard } from "./auth.guard"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./identity.module-definition"

@Module({})
/** The identity capability: the guard that closes every door by default. The app registers AuthGuard itself after the throttler and the origin guard. */
export class IdentityModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), AuthGuard], exports: [AuthGuard] }
    }
}
