/** The events the order service publishes: the contract its consumers are judged against (`be/contracts/order/events.json`, emitted by `npm run contract:emit`). The queue of an event is its name. */
export const EVENTS = {
    "order.placed": {
        version: 1,
        payload: { orderId: "string", personId: "string", totalMinorUnits: "number" },
    },
} as const
