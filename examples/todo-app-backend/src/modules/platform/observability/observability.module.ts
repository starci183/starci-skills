import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_INTERCEPTOR } from "@nestjs/core"
import { MetricsRegistryService } from "./metrics-registry.service"
import { METRICS } from "./observability.decorators"
import { ObservabilityInterceptor } from "./observability.interceptor"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./observability.module-definition"

@Module({})
/** The observability capability: the metrics registry and the interceptor that gives every request an id, a metric and an access line. */
export class ObservabilityModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: METRICS, useClass: MetricsRegistryService },
                { provide: APP_INTERCEPTOR, useClass: ObservabilityInterceptor },
            ],
            exports: [METRICS],
        }
    }
}
