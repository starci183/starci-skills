import { NestFactory } from "@nestjs/core"
import { SystemClock } from "@modules/platform/clock"
import { createJsonLogger, LoggingLogEvent } from "@modules/platform/logging"
import type { ServedApiParams } from "./serving.contracts"

/**
 * Runs one api process: `build` reads the environment and composes the root module, the app listens with shutdown hooks
 * enabled, and the start is logged. A failure at any step is logged with its cause and ends the process with exit code 1.
 */
export const serveApi = async (service: string, build: () => ServedApiParams): Promise<void> => {
    try {
        const { module, port } = build()
        const app = await NestFactory.create(module)
        app.enableShutdownHooks()
        await app.listen(port)
        createJsonLogger(new SystemClock()).info(LoggingLogEvent.ServerStarted, { service, port })
    } catch (cause) {
        createJsonLogger(new SystemClock()).error(LoggingLogEvent.StartupFailed, cause, { service })
        process.exit(1)
    }
}
