import {
    DynamicModule, MiddlewareConsumer, Module, NestModule 
} from "@nestjs/common"
import {
    WinstonService 
} from "@modules/platform/logging/winston.service"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./observability.module-definition"
import {
    MetricsService 
} from "./metrics.service"
import {
    ObservabilityMiddleware 
} from "./observability.middleware"

/**
 * platform.observability: the metrics registry and the request-scoped correlation/access seam. The
 * app composition root registers it globally (`ObservabilityModule.register({ isGlobal: true })`)
 * because the feature's probe door resolves MetricsService without importing this module - the
 * eslint no-non-global-module-import rule makes "import a capability module" illegal from a feature
 * module, so app-wide visibility is declared once, at the root, not smuggled per-consumer. The
 * middleware still covers every route: `forRoutes("*")` binds by path, not by module, so the api's
 * whole surface gets request-ids, the access line and the counter with one registration.
 */
@Module({
})
/** Nest module wiring the observability capability's providers and middleware; the app composition root registers it - other modules never import it. */
export class ObservabilityModule extends ConfigurableModuleClass implements NestModule {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []),
                MetricsService,
                ObservabilityMiddleware,
                // Provided locally, the same way notify/recur each carry their own WinstonService:
                // the house log surface is a stateless writer, not a shared instance to coordinate.
                WinstonService],
            exports: [MetricsService],
        }
    }

    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(ObservabilityMiddleware).forRoutes("*")
    }
}
