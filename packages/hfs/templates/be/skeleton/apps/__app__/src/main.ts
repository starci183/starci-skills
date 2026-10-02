import { NestFactory } from "@nestjs/core"
import { SystemClockService } from "@modules/platform/clock"
import { EnvSource, parseServerConfig } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import { parseHttpSecurityConfig } from "@modules/platform/http-security"
import { createJsonLogger, LoggingLogEvent } from "@modules/platform/logging"
import { AppModule } from "./app.module"
import type { {{appPascal}}Options } from "./{{app}}.options"

/** Reads the environment once, composes the app from the parsed options and serves until a shutdown signal. */
const bootstrap = async (): Promise<void> => {
    const env = EnvSource.fromProcess()
    const options: {{appPascal}}Options = {
        server: parseServerConfig(env),
        httpSecurity: parseHttpSecurityConfig(env),
        database: parsePrimaryDatabaseConfig(env),
    }
{{> be/common/main-listen.ts.partial}}
