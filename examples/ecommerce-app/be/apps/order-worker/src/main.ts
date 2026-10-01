import "reflect-metadata"
import { NestFactory } from "@nestjs/core"
import { SystemClock } from "@modules/platform/clock"
import { EnvSource } from "@modules/platform/config"
import { createJsonLogger, LoggingLogEvent } from "@modules/platform/logging"
import { AppModule } from "./app.module"
import { parseOrderWorkerAppOptions } from "./order-worker.options"

/** Reads the environment once and starts the order worker: no listener, its consumers work the queues until it is stopped. */
async function bootstrap(): Promise<void> {
    const options = parseOrderWorkerAppOptions(EnvSource.fromProcess())
    const app = await NestFactory.createApplicationContext(AppModule.register(options))
    app.enableShutdownHooks()
    createJsonLogger(new SystemClock()).info(LoggingLogEvent.WorkerStarted, { service: "order-worker" })
}

bootstrap().catch((error: unknown) => {
    createJsonLogger(new SystemClock()).error(LoggingLogEvent.StartupFailed, error, { service: "order-worker" })
    process.exit(1)
})
