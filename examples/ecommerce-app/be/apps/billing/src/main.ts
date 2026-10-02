import "reflect-metadata"
import { NestFactory } from "@nestjs/core"
import { SystemClock } from "@modules/platform/clock"
import { EnvSource } from "@modules/platform/config"
import { createJsonLogger, LoggingLogEvent } from "@modules/platform/logging"
import { AppModule } from "./app.module"
import { parseBillingAppOptions } from "./billing.options"

/** Reads the environment once and starts the billing worker: no listener, its consumers poll the streams until it is stopped. */
async function bootstrap(): Promise<void> {
    const options = parseBillingAppOptions(EnvSource.fromProcess())
    const app = await NestFactory.createApplicationContext(AppModule.register(options))
    app.enableShutdownHooks()
    createJsonLogger(new SystemClock()).info(LoggingLogEvent.WorkerStarted, { service: "billing" })
}

bootstrap().catch((error: unknown) => {
    createJsonLogger(new SystemClock()).error(LoggingLogEvent.StartupFailed, error, { service: "billing" })
    process.exit(1)
})
