import "reflect-metadata"
import { NestFactory } from "@nestjs/core"
import { SystemClock } from "@modules/platform/clock"
import { EnvSource } from "@modules/platform/config"
import { createJsonLogger, LoggingLogEvent } from "@modules/platform/logging"
import { AppModule } from "./app.module"
import { parseOrderAppOptions } from "./order.options"

/** Reads the environment once, builds the order api from it and listens. */
async function bootstrap(): Promise<void> {
    const options = parseOrderAppOptions(EnvSource.fromProcess())
    const app = await NestFactory.create(AppModule.register(options))
    app.enableShutdownHooks()
    await app.listen(options.port)
    createJsonLogger(new SystemClock()).info(LoggingLogEvent.ServerStarted, {
        service: "order",
        port: options.port,
    })
}

bootstrap().catch((error: unknown) => {
    createJsonLogger(new SystemClock()).error(LoggingLogEvent.StartupFailed, error, { service: "order" })
    process.exit(1)
})
