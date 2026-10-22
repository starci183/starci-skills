import type { BankTransferReceivedEvent } from "@modules/events/billing"

/** What applying one delivered bank-transfer-received event takes. */
export interface SettleBankTransferRequest {
    /** The id of the delivered event; the domain service claims it in the inbox inside its own transaction. */
    readonly eventId: string
    /** The delivered event. */
    readonly event: BankTransferReceivedEvent
}
