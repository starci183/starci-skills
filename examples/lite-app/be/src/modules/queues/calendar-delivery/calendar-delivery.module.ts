import { Module } from "@nestjs/common"
import { CalendarDeliveryQueue } from "./calendar-delivery.queue"

@Module({ providers: [CalendarDeliveryQueue], exports: [CalendarDeliveryQueue] })
/** The calendar receipt queue and its typed producer. */
export class CalendarDeliveryModule {}
