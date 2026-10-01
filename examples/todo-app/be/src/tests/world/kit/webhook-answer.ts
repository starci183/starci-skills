import type { WebhookDelivery } from "@starci/test-world/fakes"
import { isRecord } from "@modules/platform/primitives"
import { TestWorldError, TestWorldErrorCode } from "../test-world.error"

/** The JSON object the app answered a webhook delivery with; empty when there was no delivery or no JSON object; a body that is not JSON is a world failure. */
export const webhookAnswerOf = (delivery: WebhookDelivery | null): Readonly<Record<string, unknown>> => {
    if (delivery === null || delivery.response === "") return {}
    try {
        const parsed: unknown = JSON.parse(delivery.response)
        return isRecord(parsed) ? parsed : {}
    } catch (cause) {
        throw new TestWorldError({
            code: TestWorldErrorCode.PayloadInvalid,
            params: { detail: `the webhook answer to ${delivery.url} is not JSON` },
            cause,
        })
    }
}
