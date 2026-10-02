import { NestFactory } from "@nestjs/core"
import { SystemClockService } from "@modules/platform/clock"
import { EnvSource, parseServerConfig } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import { parseHttpSecurityConfig } from "@modules/platform/http-security"
import { createJsonLogger, LoggingLogEvent } from "@modules/platform/logging"
import { parseSupabaseConfig } from "@modules/integrations/supabase"
import { AppModule } from "./app.module"
import type { ApiOptions } from "./api.options"

/** Reads the environment once, composes the API from parsed options and serves until a shutdown signal. */
const bootstrap = async (): Promise<void> => {
    const env = EnvSource.fromProcess()
    const options: ApiOptions = {
        server: parseServerConfig(env),
        httpSecurity: parseHttpSecurityConfig(env),
        database: parsePrimaryDatabaseConfig(env),
        supabase: parseSupabaseConfig(env),
    }
    const app = await NestFactory.create(AppModule.register(options), { rawBody: true })
    app.enableCors({ origin: [...options.httpSecurity.allowedOrigins] })
    app.enableShutdownHooks()
    await app.listen(options.server.port)
    createJsonLogger(new SystemClockService()).info(LoggingLogEvent.ServerStarted, {
        service: "api",
        port: options.server.port,
    })
}

bootstrap().catch((error: unknown) => {
    createJsonLogger(new SystemClockService()).error(LoggingLogEvent.StartupFailed, error, { service: "api" })
    process.exitCode = 1
})
