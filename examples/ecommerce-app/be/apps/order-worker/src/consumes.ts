/** The events of its sibling services the order worker reads: service, event name, contract version (judged against `be/contracts/<service>/events.json`). */
export const CONSUMES = {
    billing: { "billing.invoice-rejected": 1 },
} as const
