import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./calendar-delivery.module-definition"
import { ProcessCalendarDeliveryStep } from "./steps/process-calendar-delivery.step"

@Module({ providers: [ProcessCalendarDeliveryStep], exports: [ProcessCalendarDeliveryStep] })
/** The calendar receipt job and its single processing step. */
export class CalendarDeliveryJobModule extends ConfigurableModuleClass {}
