// Imports of the host (resolve them to its aliases): none.
/** The events of its sibling services the order service reads: service, event name, contract version (judged against `be/contracts/<service>/events.json`). */
export const CONSUMES = {
    billing: { "billing.invoice-issued": 1, "billing.invoice-rejected": 1 },
} as const
