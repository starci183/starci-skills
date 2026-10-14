import { NestFactory } from "@nestjs/core"
import { SystemClockService } from "@modules/platform/clock"
import { EnvSource } from "@modules/platform/config"
import { applyHttpSecurity } from "@modules/platform/http-security"
import { createJsonLogger, LoggingLogEvent } from "@modules/platform/logging"
import { AppModule } from "./app.module"
import { read{{appPascal}}Env } from "./{{app}}.env"

/** Reads the environment once, composes the app from the parsed options and serves until a shutdown signal. */
const bootstrap = async (): Promise<void> => {
    const env = EnvSource.fromProcess()
    const options = read{{appPascal}}Env(env)
    const app = await NestFactory.create(AppModule.register(options), { rawBody: true })
    applyHttpSecurity(app, options.httpSecurity, { trustProxy: 1 })
    app.enableShutdownHooks()
    await app.listen(options.server.port)
    createJsonLogger(new SystemClockService()).info(LoggingLogEvent.ServerStarted, {
        service: "{{app}}",
        port: options.server.port,
    })
}

bootstrap().catch((error: unknown) => {
    createJsonLogger(new SystemClockService()).error(LoggingLogEvent.StartupFailed, error, { service: "{{app}}" })
    process.exitCode = 1
})
