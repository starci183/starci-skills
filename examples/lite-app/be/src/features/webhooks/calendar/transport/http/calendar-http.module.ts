import { Module } from "@nestjs/common"
import { CalendarWebhook } from "./calendar.webhook"

@Module({ controllers: [CalendarWebhook] })
/** The HTTP transport of the calendar notifier: its webhook door; the intake service and the signature service come from the app's capabilities. */
export class CalendarHttpModule {}
