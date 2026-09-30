import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./session.module-definition"
import { SessionService } from "./session.service"

@Module({})
/** The session capability: opaque bearer sessions kept in the cache. */
export class SessionModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), SessionService], exports: [SessionService] }
    }
}
