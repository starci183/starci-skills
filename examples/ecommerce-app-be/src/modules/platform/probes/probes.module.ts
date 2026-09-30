import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ProbeChecker } from "./probe-checker.service"
import { PROBE_CHECKER, PROBES } from "./probes.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./probes.module-definition"
import type { Probe } from "./probes.port"

@Module({})
/** The probes capability: the checker that probes the dependencies the app names in its options. */
export class ProbesModule extends ConfigurableModuleClass {
    /** Registers the capability once per app with the probes it reports on. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                {
                    provide: PROBES,
                    inject: [...options.probes],
                    useFactory: (...probes: Array<Probe>) => probes,
                },
                { provide: PROBE_CHECKER, useClass: ProbeChecker },
            ],
            exports: [PROBE_CHECKER],
        }
    }
}
