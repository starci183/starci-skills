import "reflect-metadata"
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

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule)
    const config = app.get(AppConfigService)
    await app.listen(config.getPort())
    app.get(Logger).info(LogId.ServerStarted,
        {
            service: "order", port: config.getPort() 
        })
}

bootstrap().catch((error: unknown) => {
    createJsonLogger().error(LogId.StartupFailed,
        {
            service: "order", message: error instanceof Error ? error.message : String(error) 
        })
    process.exit(1)
})
