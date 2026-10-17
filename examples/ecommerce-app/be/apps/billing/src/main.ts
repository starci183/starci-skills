import "reflect-metadata"
import { NestFactory } from "@nestjs/core"
import type { Application } from "express"
import { SystemClock } from "@modules/platform/clock"
import { EnvSource } from "@modules/platform/config"
import { applySecurityHeaders } from "@modules/platform/http-security"
import { createJsonLogger, LoggingLogEvent } from "@modules/platform/logging"
import { AppModule } from "./app.module"
import { readBillingEnv } from "./billing.env"

/** Reads the environment once, builds the billing api from it and listens; the raw body is kept so a webhook signature is checked on the exact bytes. */
async function bootstrap(): Promise<void> {
    const env = EnvSource.fromProcess()
    const options = readBillingEnv(env)
    const app = await NestFactory.create(AppModule.register(options), { rawBody: true })
    app.enableShutdownHooks()
    applySecurityHeaders(app)
    const server: Application = app.getHttpAdapter().getInstance()
    server.set("trust proxy", 0)
    app.enableCors({ origin: [...options.httpSecurity.allowedOrigins] })
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
