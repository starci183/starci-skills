import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { TIMER } from "./retry.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./retry.module-definition"
import { SystemTimerService } from "./system-timer.service"

@Module({})
/** Provides the cancellable Timer port backed by the host timer API. */
export class RetryModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: TIMER, useClass: SystemTimerService }],
            exports: [TIMER],
        }
    }
}
