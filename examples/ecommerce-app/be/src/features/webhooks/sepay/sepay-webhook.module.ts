import { Module } from "@nestjs/common"
import { SepayWebhook } from "./sepay.webhook"

@Module({ controllers: [SepayWebhook] })
/** The webhook door of the SePay bank transfer notifier; the payment service and the signature service come from the app's capabilities. */
export class SepayWebhookModule {}
