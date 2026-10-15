import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./send-reminder.module-definition"
import { MarkRemindedStep } from "./steps/mark-reminded.step"

@Module({ providers: [MarkRemindedStep], exports: [MarkRemindedStep] })
/** The application of the send-reminder job: its step; the queue transport module imports it. */
export class SendReminderModule extends ConfigurableModuleClass {}
