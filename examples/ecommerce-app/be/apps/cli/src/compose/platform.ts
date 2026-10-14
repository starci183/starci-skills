import type { DynamicModule } from "@nestjs/common"
import { ClockModule } from "@modules/platform/clock"
import { LoggingModule } from "@modules/platform/logging"

/** Every CLI command uses the app-wide clock and logger. */
export const platformModules = (): Array<DynamicModule> => [
    ClockModule.register({ isGlobal: true }),
    LoggingModule.register({ isGlobal: true }),
]
