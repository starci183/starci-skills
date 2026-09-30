import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { HealthChecker } from "./health-checker.service"
import { HEALTH_CHECKER, HEALTH_PROBES } from "./health.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./health.module-definition"
import type { HealthProbe } from "./health.port"

@Module({})
/** The health capability: the checker that probes the dependencies the app names in its options. */
export class HealthModule extends ConfigurableModuleClass {
    /** Registers the capability once per app with the probes it reports on. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                {
                    provide: HEALTH_PROBES,
                    inject: [...options.probes],
                    useFactory: (...probes: Array<HealthProbe>) => probes,
                },
                { provide: HEALTH_CHECKER, useClass: HealthChecker },
            ],
            exports: [HEALTH_CHECKER],
        }
    }
}
