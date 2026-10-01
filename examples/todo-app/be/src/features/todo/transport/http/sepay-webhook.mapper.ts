import type { ConfirmPaymentRequest, ConfirmedPayment } from "../../application/confirm-payment.contracts"
import type { SepayWebhookRequest } from "./dto/sepay-webhook.request"
import type { SepayWebhookResponse } from "./dto/sepay-webhook.response"

/** Maps the delivery to the command request; a period end is parsed to an instant, and its absence stays absent. */
export const toConfirmPaymentRequest = (
    authorization: string | undefined,
    body: SepayWebhookRequest,
): ConfirmPaymentRequest => ({
    authorization,
    gatewayIntentId: body.id,
    outcome: body.status,
    periodEnd: body.periodEnd === undefined ? undefined : new Date(body.periodEnd),
})

/** Maps what the delivery caused to the answer of the door: `{ ignored: true }` alone, or what the confirmation changed. */
export const toSepayWebhookResponse = (confirmed: ConfirmedPayment): SepayWebhookResponse => confirmed
