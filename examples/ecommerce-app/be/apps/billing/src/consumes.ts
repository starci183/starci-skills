/** The events of its sibling services the billing worker reads: service, event name, contract version (judged against `be/contracts/<service>/events.json`). */
export const CONSUMES = {
    order: { "order.placed": 1 },
} as const
