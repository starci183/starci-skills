import "reflect-metadata"
import { NestFactory } from "@nestjs/core"
import type { Application } from "express"
import { SystemClock } from "@modules/platform/clock"
import { EnvSource } from "@modules/platform/config"
import { securityHeaders } from "@modules/platform/http-security"
import { createJsonLogger, LoggingLogEvent } from "@modules/platform/logging"
import { AppModule } from "./app.module"
import { readOrderEnv } from "./order.env"

/** Reads the environment once, builds the order api from it and listens. */
async function bootstrap(): Promise<void> {
    const env = EnvSource.fromProcess()
    const options = readOrderEnv(env)
    const app = await NestFactory.create(AppModule.register(options))
    app.enableShutdownHooks()
    const server: Application = app.getHttpAdapter().getInstance()
    server.disable("x-powered-by")
    app.use(securityHeaders)
    server.set("trust proxy", 0)
    // The shop's browser calls this GraphQL API directly (owner ruling 2026-10-13): the allowlisted origins may.
    app.enableCors({ origin: [...options.httpSecurity.allowedOrigins] })
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
