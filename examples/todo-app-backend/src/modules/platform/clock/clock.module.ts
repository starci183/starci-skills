import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    Clock 
} from "./clock.port"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./clock.module-definition"
import {
    SystemClock 
} from "./system-clock"

@Module({
})
/** Provides the `Clock` port backed by the system clock; the app composition root registers it once, globally. */
export class ClockModule extends ConfigurableModuleClass {
    /** Builds the dynamic module; `isGlobal` decides whether every capability sees the clock without importing it. */
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []),
                {
                    provide: Clock, useClass: SystemClock 
                }],
            exports: [Clock],
        }
    }
}
