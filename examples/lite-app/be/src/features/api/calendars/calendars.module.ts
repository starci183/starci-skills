import { Module } from "@nestjs/common"
import { CreateCalendarHandler } from "./application/create-calendar.handler"
import { GetCalendarHandler } from "./application/get-calendar.handler"

@Module({ providers: [GetCalendarHandler, CreateCalendarHandler] })
/** The calendars feature: the handlers of its application. */
export class CalendarsApiModule {}
