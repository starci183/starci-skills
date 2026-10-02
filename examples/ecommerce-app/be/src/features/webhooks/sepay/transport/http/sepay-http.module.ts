import { Module } from "@nestjs/common"
import { SepayWebhook } from "./sepay.webhook"

@Module({ controllers: [SepayWebhook] })
/** The HTTP transport of the SePay bank transfer notifier: its webhook door; the payment service and the signature service come from the app's capabilities. */
export class SepayHttpModule {}
