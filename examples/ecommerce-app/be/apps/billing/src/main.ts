import "reflect-metadata"
import { NestFactory } from "@nestjs/core"
import { SystemClock } from "@modules/platform/clock"
import { EnvSource } from "@modules/platform/config"
import { createJsonLogger, LoggingLogEvent } from "@modules/platform/logging"
import { AppModule } from "./app.module"
import { parseBillingAppOptions } from "./billing.options"

/** Reads the environment once, builds the billing api from it and listens; the raw body is kept so a webhook signature is checked on the exact bytes. */
async function bootstrap(): Promise<void> {
    const options = parseBillingAppOptions(EnvSource.fromProcess())
    const app = await NestFactory.create(AppModule.register(options), { rawBody: true })
    app.enableShutdownHooks()
    await app.listen(options.port)
    createJsonLogger(new SystemClock()).info(LoggingLogEvent.ServerStarted, {
        service: "billing",
        port: options.port,
    })
}

bootstrap().catch((error: unknown) => {
    createJsonLogger(new SystemClock()).error(LoggingLogEvent.StartupFailed, error, { service: "billing" })
    process.exit(1)
})
