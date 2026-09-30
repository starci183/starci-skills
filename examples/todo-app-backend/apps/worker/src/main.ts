import "reflect-metadata"
import { NestFactory } from "@nestjs/core"
import { SystemClock } from "@modules/platform/clock"
import { EnvSource } from "@modules/platform/config"
import { JsonLoggerService, LoggingLogEvent } from "@modules/platform/logging"
import { AppModule } from "./app.module"
import { parseIdentityConfig } from "@modules/domain/identity"
import { parsePlanConfig } from "@modules/domain/plan"
import { parseRecurConfig } from "@modules/domain/recur"
import { parseUploadConfig } from "@modules/domain/upload"
import { parseKeycloakConfig } from "@modules/integrations/keycloak"
import { parseNotifySmtpConfig } from "@modules/integrations/notify-smtp"
import { parseSepayConfig } from "@modules/integrations/sepay"
import { parseUploadStorageConfig } from "@modules/integrations/upload"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import { parseMessagingConfig } from "@modules/platform/messaging"
import { parseSchedulingConfig } from "@modules/platform/scheduling"
import type { WorkerAppOptions } from "./worker.options"

/** Reads the environment once and starts the worker: no listener, its jobs tick and its consumers poll until it is stopped. */
async function bootstrap(): Promise<void> {
    const env = EnvSource.fromProcess()
    const options: WorkerAppOptions = {
        database: parsePrimaryDatabaseConfig(env),
        scheduling: parseSchedulingConfig(env),
        messaging: parseMessagingConfig(env),
        identity: parseIdentityConfig(env),
        keycloak: parseKeycloakConfig(env),
        sepay: parseSepayConfig(env),
        plan: parsePlanConfig(env),
        recur: parseRecurConfig(env),
        upload: parseUploadConfig(env),
        uploadStorage: parseUploadStorageConfig(env),
        notifySmtp: parseNotifySmtpConfig(env),
    }
    const app = await NestFactory.createApplicationContext(AppModule.register(options))
    app.enableShutdownHooks()
    new JsonLoggerService(new SystemClock(), process.stdout, process.stderr).info(LoggingLogEvent.WorkerStarted, { service: "worker" })
}

bootstrap().catch((error: unknown) => {
    new JsonLoggerService(new SystemClock(), process.stdout, process.stderr).error(LoggingLogEvent.StartupFailed, error, { service: "worker" })
    process.exit(1)
})
