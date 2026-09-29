import {
    Global, Module
} from "@nestjs/common"
import {
    Clock 
} from "ecommerce-app-be/modules/platform/clock"
import {
    createJsonLogger
} from "./json-logger"
import {
    Logger
} from "./logger.port"

@Global()
@Module({
    providers: [{
        provide: Logger, inject: [Clock], useFactory: (clock: Clock): Logger => createJsonLogger(clock)
    }],
    exports: [Logger],
})
/** Provides the logging port to every capability; one of the platform modules that may be global. It reads time through the Clock the app registers globally. */
export class LoggingModule {}
