import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { CLOCK } from "./clock.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./clock.module-definition"
import { SystemClock } from "./system-clock.service"

@Module({})
/** Provides the Clock port backed by the system clock. */
export class ClockModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: CLOCK, useClass: SystemClock }],
            exports: [CLOCK],
        }
    }
}
