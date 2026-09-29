import {
    Global, Module
} from "@nestjs/common"
import {
    createJsonLogger
} from "./json-logger"
import {
    Logger
} from "./logger.port"

/** Provides the logging port to every capability; one of the platform modules that may be global. */
@Global()
@Module({
    providers: [{
        provide: Logger, useFactory: (): Logger => createJsonLogger()
    }],
    exports: [Logger],
})
export class LoggingModule {}
