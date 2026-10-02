import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./@@name@@.module-definition"
import { @@Name@@Projection } from "./@@name@@.projection"

@Module({})
/** The @@name@@ read model: its projection, called by a reactor or a job to recompute and by the api to read; the app registers it once with `isGlobal`. */
export class @@Name@@Module extends ConfigurableModuleClass {
    /** Registers the projection once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), @@Name@@Projection],
            exports: [@@Name@@Projection],
        }
    }
}
