import "reflect-metadata"
import { NestFactory } from "@nestjs/core"
import { SystemClockService } from "@modules/platform/clock"
import { EnvSource } from "@modules/platform/config"
import { createJsonLogger, LoggingLogEvent } from "@modules/platform/logging"
import { AppModule } from "./app.module"
import { parseIdentityAppOptions } from "./identity.options"

/** Reads the environment once, builds the identity api from it and listens. */
async function bootstrap(): Promise<void> {
    const options = parseIdentityAppOptions(EnvSource.fromProcess())
    const app = await NestFactory.create(AppModule.register(options))
    app.enableShutdownHooks()
    await app.listen(options.port)
    createJsonLogger(new SystemClockService()).info(LoggingLogEvent.ServerStarted, { service: "identity", port: options.port })
}

bootstrap().catch((error: unknown) => {
    createJsonLogger(new SystemClockService()).error(LoggingLogEvent.StartupFailed, error, { service: "identity" })
    process.exit(1)
})
