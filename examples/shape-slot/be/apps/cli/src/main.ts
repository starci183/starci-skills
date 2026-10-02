import "reflect-metadata"
import { CommandFactory } from "nest-commander"
import { SystemClockService } from "@modules/platform/clock"
import { EnvSource } from "@modules/platform/config"
import { createJsonLogger, LoggingLogEvent } from "@modules/platform/logging"
import { AppModule } from "./app.module"
import { parseCliAppOptions } from "./cli.options"

/** The command line of the back end: reads the environment once and runs the command its arguments name (`cli migrate run`). */
async function bootstrap(): Promise<void> {
    const logger = createJsonLogger(new SystemClockService())
    await CommandFactory.run(AppModule.register(parseCliAppOptions(EnvSource.fromProcess())), {
        logger: false,
        errorHandler: (error: Error) => {
            logger.error(LoggingLogEvent.StartupFailed, error, { service: "cli" })
            process.exit(1)
        },
    })
}

bootstrap().catch((error: unknown) => {
    createJsonLogger(new SystemClockService()).error(LoggingLogEvent.StartupFailed, error, { service: "cli" })
    process.exit(1)
})
