import "reflect-metadata"
import {
    ValidationPipe 
} from "@nestjs/common"
import {
    NestFactory 
} from "@nestjs/core"
import {
    AppModule 
} from "./app.module"
import {
    AppConfigService 
} from "ecommerce-app-be/modules/platform/config/order"
import {
    LogId, Logger, createJsonLogger 
} from "ecommerce-app-be/modules/platform/logging"
import {
    SystemClock 
} from "ecommerce-app-be/modules/platform/clock"

/** Boots the api: the global validation pipe, then the listener on the configured port. */
async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule)
    const config = app.get(AppConfigService)
    // The GraphQL input classes carry class-validator decorators; this pipe is what enforces them.
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true, transform: true 
    }))
    await app.listen(config.getPort())
    app.get(Logger).info(LogId.ServerStarted,
        {
            service: "order", port: config.getPort() 
        })
}

bootstrap().catch((error: unknown) => {
    const logger = createJsonLogger(new SystemClock())
    logger.error(LogId.StartupFailed,
        {
            service: "order", message: error instanceof Error ? error.message : String(error) 
        })
    process.exit(1)
})
