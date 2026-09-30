import { toConfirmPaymentRequest, toIgnoredSepayWebhookResponse, toSepayWebhookResponse } from "./sepay-webhook.mapper"

describe("sepay-webhook mapper", () => {
    it("parses the period end of a paid delivery to an instant", () => {
        expect(toConfirmPaymentRequest({ id: "g1", status: "paid", periodEnd: "2026-10-01T00:00:00.000Z" })).toEqual({
            gatewayIntentId: "g1",
            outcome: "paid",
            periodEnd: new Date("2026-10-01T00:00:00.000Z"),
        })
    })

    it("keeps an absent period end absent", () => {
        expect(toConfirmPaymentRequest({ id: "g2", status: "failed" })).toEqual({
            gatewayIntentId: "g2",
            outcome: "failed",
            periodEnd: undefined,
        })
    })

    it("answers what the confirmation changed, or that the delivery was ignored", () => {
        expect(toSepayWebhookResponse({ applied: true, subscriptionStatus: "active" })).toEqual({
            ignored: false,
            applied: true,
            subscriptionStatus: "active",
        })
        expect(toIgnoredSepayWebhookResponse()).toEqual({ ignored: true })
    })
})
