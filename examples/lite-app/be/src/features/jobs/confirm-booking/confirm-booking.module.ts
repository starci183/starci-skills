import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./confirm-booking.module-definition"
import { MarkConfirmedStep } from "./steps/mark-confirmed.step"

@Module({ providers: [MarkConfirmedStep], exports: [MarkConfirmedStep] })
/** The application of the confirm-booking job: its step; the queue transport module imports it. */
export class ConfirmBookingModule extends ConfigurableModuleClass {}
