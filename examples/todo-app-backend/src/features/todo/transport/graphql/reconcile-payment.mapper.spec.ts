import { toReconcilePaymentRequest, toReconcilePaymentType } from "./reconcile-payment.mapper"

describe("reconcile-payment mapper", () => {
    it("maps the input to the request and the reconciled payment to the type", () => {
        expect(toReconcilePaymentRequest({ paymentIntentId: "i1" })).toEqual({ paymentIntentId: "i1" })
        const reconciled = { gatewayStatus: "paid", applied: true, subscriptionStatus: "active" }
        expect(toReconcilePaymentType(reconciled)).toEqual(reconciled)
    })
})
