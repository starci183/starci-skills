import type { DynamicModule } from "@nestjs/common"
import { BookingStatusSseModule } from "@features/realtime/booking-status"

/**
 * The realtime area of the API: the push channels, each a server-sent-events door over the hub of the platform. A composition group
 * holds one area's module list and nothing else; `app.module.ts` spreads it into its imports.
 */
export const realtimeModules = (): Array<DynamicModule> => [BookingStatusSseModule.register({})]
