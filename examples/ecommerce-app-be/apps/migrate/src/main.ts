import "reflect-metadata"
import {
    NestFactory 
} from "@nestjs/core"
import {
    SystemClock 
} from "ecommerce-app-be/modules/platform/clock"
import {
    IdentityConfigService, OrderConfigService 
} from "ecommerce-app-be/modules/platform/config"
import {
    runIdentityMigrations, runOrderMigrations 
} from "ecommerce-app-be/modules/platform/databases"
import {
    LogId, Logger, createJsonLogger 
} from "ecommerce-app-be/modules/platform/logging"
import {
    AppModule 
} from "./app.module"

/** Applies the pending migrations of each connection once (identity, then order) and exits; the apis start only after this has finished. */
async function bootstrap(): Promise<void> {
    const context = await NestFactory.createApplicationContext(AppModule)
    try {
        const identity = await runIdentityMigrations(context.get(IdentityConfigService).getDatabaseUrl())
        const order = await runOrderMigrations(context.get(OrderConfigService).getDatabaseUrl())
        context.get(Logger).info(LogId.MigrationsApplied,
            {
                identity, order 
            })
    } finally {
        await context.close()
    }
}

bootstrap().catch((error: unknown) => {
    const logger = createJsonLogger(new SystemClock())
    logger.error(LogId.StartupFailed,
        {
            service: "migrate", message: error instanceof Error ? error.message : String(error) 
        })
    process.exit(1)
})
