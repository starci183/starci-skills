import type { ModuleMetadata } from "@nestjs/common"
import { BookingsGraphqlModule } from "@features/api/bookings"
import { CalendarsGraphqlModule } from "@features/api/calendars"
import { ResourcesGraphqlModule } from "@features/api/resources"
import { CalendarDeliveryQueueModule } from "@features/jobs/calendar-delivery"
import { ConfirmBookingQueueModule } from "@features/jobs/confirm-booking"
import { SendReminderQueueModule } from "@features/jobs/send-reminder"
import { CalendarHttpModule } from "@features/webhooks/calendar"
import { BookingsModule } from "@modules/domain/bookings"
import { CalendarInboxModule } from "@modules/domain/calendar-inbox"
import { CalendarsModule } from "@modules/domain/calendars"
import { ResourcesModule } from "@modules/domain/resources"

/**
 * The bookings area of the API: the resources, calendars and bookings capabilities with the calendar inbox, their
 * GraphQL doors, the calendar webhook door and the confirm-booking queue. A composition group holds one area's module
 * list and nothing else; `app.module.ts` spreads it into its imports.
 */
export const bookingsModules = (): NonNullable<ModuleMetadata["imports"]> => [
    ResourcesGraphqlModule.register({}),
    CalendarsGraphqlModule.register({}),
    BookingsGraphqlModule.register({}),
    CalendarInboxModule.register({ isGlobal: true }),
    CalendarHttpModule.register({}),
    CalendarsModule.register({ isGlobal: true }),
    BookingsModule.register({ isGlobal: true }),
    ResourcesModule.register({ isGlobal: true }),
    CalendarDeliveryQueueModule.register({}),
    ConfirmBookingQueueModule.register({}),
    SendReminderQueueModule.register({}),
]
