import "reflect-metadata"
import { NestFactory } from "@nestjs/core"
import { SystemClock } from "@modules/platform/clock"
import { EnvSource } from "@modules/platform/config"
import { JsonLoggerService, LoggingLogEvent } from "@modules/platform/logging"
import { AppModule } from "./app.module"
import { parseIdentityConfig } from "@modules/domain/identity"
import { parseCommissionConfig } from "@modules/domain/commission"
import { parsePlanConfig } from "@modules/domain/plan"
import { parseRecurConfig } from "@modules/domain/recur"
import { parseUploadConfig } from "@modules/domain/upload"
import { parseKeycloakConfig } from "@modules/integrations/keycloak"
import { parseNotifySmtpConfig } from "@modules/integrations/notify-smtp"
import { parseSepayConfig } from "@modules/integrations/sepay"
import { parseUploadStorageConfig } from "@modules/integrations/upload"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import { parseHttpSecurityConfig } from "@modules/platform/http-security"
import type { TodoAppOptions } from "./todo.options"

/** Reads the environment once, builds the todo api from it and listens. */
async function bootstrap(): Promise<void> {
    const env = EnvSource.fromProcess()
    const options: TodoAppOptions = {
        port: env.int("PORT"),
        database: parsePrimaryDatabaseConfig(env),
        httpSecurity: parseHttpSecurityConfig(env),
        identity: parseIdentityConfig(env),
        keycloak: parseKeycloakConfig(env),
        sepay: parseSepayConfig(env),
        plan: parsePlanConfig(env),
        commission: parseCommissionConfig(env),
        recur: parseRecurConfig(env),
        upload: parseUploadConfig(env),
        uploadStorage: parseUploadStorageConfig(env),
        notifySmtp: parseNotifySmtpConfig(env),
    }
    const app = await NestFactory.create(AppModule.register(options))
    app.enableCors({ origin: [...options.httpSecurity.allowedOrigins] })
    app.enableShutdownHooks()
    await app.listen(options.port)
    new JsonLoggerService(new SystemClock(), process.stdout, process.stderr).info(LoggingLogEvent.ServerStarted, { service: "todo", port: options.port })
}

bootstrap().catch((error: unknown) => {
    new JsonLoggerService(new SystemClock(), process.stdout, process.stderr).error(LoggingLogEvent.StartupFailed, error, { service: "todo" })
    process.exit(1)
})
