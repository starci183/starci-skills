import { Module } from "@nestjs/common"
import { MarkRemindedStep } from "./steps/mark-reminded.step"

@Module({ providers: [MarkRemindedStep], exports: [MarkRemindedStep] })
/** The application of the send-reminder job: its step; the queue transport module imports it. */
export class SendReminderModule {}
