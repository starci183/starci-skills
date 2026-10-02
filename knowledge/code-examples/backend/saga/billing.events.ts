/** The events the billing service publishes: the contract its consumers are judged against (`be/contracts/billing/events.json`, emitted by `npm run contract:emit`). The queue of an event is its name. */
export const EVENTS = {
    "billing.invoice-issued": {
        version: 1,
        payload: { orderId: "string", totalMinorUnits: "number" },
    },
    "billing.invoice-rejected": {
        version: 1,
        compensates: "order.placed",
        payload: { orderId: "string", reason: "string", totalMinorUnits: "number" },
    },
} as const
