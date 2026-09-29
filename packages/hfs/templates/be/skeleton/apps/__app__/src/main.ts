import { NestFactory } from "@nestjs/core"
import { EnvSource, parseServerConfig } from "@modules/platform/config"
import { createJsonLogger, LogId } from "@modules/platform/logging"
import { AppModule } from "./app.module"
import type { {{appPascal}}Options } from "./{{app}}.options"

/** Reads the environment once, composes the app from the parsed options and serves until a shutdown signal. */
const bootstrap = async (): Promise<void> => {
    const env = EnvSource.fromProcess()
    const options: {{appPascal}}Options = { server: parseServerConfig(env) }
    const app = await NestFactory.create(AppModule.register(options))
    app.enableShutdownHooks()
    await app.listen(options.server.port)
}

const logger = createJsonLogger()
bootstrap().catch((cause: unknown) => {
    logger.error(LogId.StartupFailed, { failure: cause instanceof Error ? { name: cause.name, message: cause.message } : { name: typeof cause } })
    process.exitCode = 1
})
