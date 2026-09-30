import type { ConfirmPaymentRequest, ConfirmedPayment } from "../../application/confirm-payment.contracts"
import type { SepayWebhookRequest } from "./dto/sepay-webhook.request"
import type { SepayWebhookResponse } from "./dto/sepay-webhook.response"

/** Maps the delivery body to the command request; a period end is parsed to an instant, and its absence stays absent. */
export const toConfirmPaymentRequest = (body: SepayWebhookRequest): ConfirmPaymentRequest => ({
    gatewayIntentId: body.id,
    outcome: body.status,
    periodEnd: body.periodEnd === undefined ? undefined : new Date(body.periodEnd),
})

/** Maps what the confirmation changed to the answer of the door. */
export const toSepayWebhookResponse = (confirmed: ConfirmedPayment): SepayWebhookResponse => ({
    ignored: false,
    applied: confirmed.applied,
    subscriptionStatus: confirmed.subscriptionStatus,
})

/** The answer to a delivery that was ignored. */
export const toIgnoredSepayWebhookResponse = (): SepayWebhookResponse => ({ ignored: true })
