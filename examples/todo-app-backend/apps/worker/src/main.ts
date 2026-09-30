import "reflect-metadata"
import { NestFactory } from "@nestjs/core"
import { SystemClock } from "@modules/platform/clock"
import { EnvSource } from "@modules/platform/config"
import { createJsonLogger, LoggingLogEvent } from "@modules/platform/logging"
import { AppModule } from "./app.module"
import { parseWorkerAppOptions } from "./worker.options"

/** Reads the environment once and starts the worker: no listener, its jobs tick and its consumers poll until it is stopped. */
async function bootstrap(): Promise<void> {
    const options = parseWorkerAppOptions(EnvSource.fromProcess())
    const app = await NestFactory.createApplicationContext(AppModule.register(options))
    app.enableShutdownHooks()
    createJsonLogger(new SystemClock()).info(LoggingLogEvent.WorkerStarted, { service: "worker" })
}

bootstrap().catch((error: unknown) => {
    createJsonLogger(new SystemClock()).error(LoggingLogEvent.StartupFailed, error, { service: "worker" })
    process.exit(1)
})
