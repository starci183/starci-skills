import "reflect-metadata"
import { NestFactory } from "@nestjs/core"
import { SystemClock } from "@modules/platform/clock"
import { EnvSource } from "@modules/platform/config"
import { createJsonLogger, LoggingLogEvent } from "@modules/platform/logging"
import { AppModule } from "./app.module"
import { parseTodoAppOptions } from "./todo.options"

/** Reads the environment once, builds the todo api from it and listens. */
async function bootstrap(): Promise<void> {
    const options = parseTodoAppOptions(EnvSource.fromProcess())
    const app = await NestFactory.create(AppModule.register(options))
    app.enableCors({ origin: [...options.httpSecurity.allowedOrigins] })
    app.enableShutdownHooks()
    await app.listen(options.port)
    createJsonLogger(new SystemClock()).info(LoggingLogEvent.ServerStarted, { service: "todo", port: options.port })
}

bootstrap().catch((error: unknown) => {
    createJsonLogger(new SystemClock()).error(LoggingLogEvent.StartupFailed, error, { service: "todo" })
    process.exit(1)
})
