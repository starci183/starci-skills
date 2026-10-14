import type { DynamicModule } from "@nestjs/common"
import { ClockModule } from "@modules/platform/clock"
import { LoggingModule } from "@modules/platform/logging"

/** The shared clock and logger; migrations retain their Supabase CLI authority. */
export const platformModules = (): Array<DynamicModule> => [
    ClockModule.register({ isGlobal: true }),
    LoggingModule.register({ isGlobal: true }),
]
