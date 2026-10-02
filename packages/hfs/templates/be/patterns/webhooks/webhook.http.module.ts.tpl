import { Module } from "@nestjs/common"
import { @@Provider@@Webhook } from "./@@provider@@.webhook"

@Module({ controllers: [@@Provider@@Webhook] })
/** The HTTP transport of the @@provider@@ notifier: its webhook door; the intake service and the signature service come from the app's capabilities. */
export class @@Provider@@HttpModule {}
