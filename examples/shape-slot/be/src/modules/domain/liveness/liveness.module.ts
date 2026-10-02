import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { LivenessService } from "./liveness.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./liveness.module-definition"

@Module({})
/** The liveness capability: the process reports itself alive from the Clock, with no dependency to probe. */
export class LivenessModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), LivenessService], exports: [LivenessService] }
    }
}
