import { NestFactory } from "@nestjs/core"
import type { NestExpressApplication } from "@nestjs/platform-express"
import { SystemClockService } from "@modules/platform/clock"
import { EnvSource } from "@modules/platform/config"
import { securityHeaders } from "@modules/platform/http-security"
import { createJsonLogger, LoggingLogEvent } from "@modules/platform/logging"
import { AppModule } from "./app.module"
import { readCoreEnv } from "./core.env"

/** Reads the environment once, composes the app from the parsed options and serves until a shutdown signal. */
const bootstrap = async (): Promise<void> => {
    const env = EnvSource.fromProcess()
    const options = readCoreEnv(env)
    const app = await NestFactory.create<NestExpressApplication>(AppModule.register(options))
    const server = app.getHttpAdapter().getInstance()
    server.disable("x-powered-by")
    // Configuration validates the supported hop counts before the listener starts.
    switch (options.httpSecurity.trustProxy ?? 0) {
        case 0:
            server.set("trust proxy", 0)
            break
        case 1:
            server.set("trust proxy", 1)
            break
        case 2:
            server.set("trust proxy", 2)
            break
        case 3:
            server.set("trust proxy", 3)
            break
        case 4:
            server.set("trust proxy", 4)
            break
        case 5:
            server.set("trust proxy", 5)
            break
        case 6:
            server.set("trust proxy", 6)
            break
        case 7:
            server.set("trust proxy", 7)
            break
        case 8:
            server.set("trust proxy", 8)
            break
        case 9:
            server.set("trust proxy", 9)
            break
        case 10:
            server.set("trust proxy", 10)
            break
    }
    app.use(securityHeaders)
    app.enableCors({ origin: [...options.httpSecurity.allowedOrigins] })
    app.enableShutdownHooks()
    await app.listen(options.server.port)
    createJsonLogger(new SystemClockService()).info(LoggingLogEvent.ServerStarted, {
        service: "core",
        port: options.server.port,
    })
}

bootstrap().catch((error: unknown) => {
    createJsonLogger(new SystemClockService()).error(LoggingLogEvent.StartupFailed, error, { service: "core" })
    process.exitCode = 1
})
