import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { RetryModule } from "@modules/platform/retry"
import { LivenessService } from "./liveness.service"
import { ReadinessService } from "./readiness.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./liveness.module-definition"

@Module({})
/** The liveness capability: the process reports itself alive from the Clock, and ready only while its required dependencies answer. */
export class LivenessModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), RetryModule.register({})],
            providers: [...(base.providers ?? []), LivenessService, ReadinessService],
            exports: [LivenessService, ReadinessService],
        }
    }
}
