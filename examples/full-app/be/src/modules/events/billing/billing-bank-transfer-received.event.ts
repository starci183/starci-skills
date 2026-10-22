import { BaseEvent, readEventOf } from "@modules/platform/event-bus"
import type { ParsedEvent } from "@modules/platform/event-bus"

/** A verified bank transfer recorded by the webhook receipt transaction. */
export interface BankTransferReceivedPayload {
    /** Stable provider transfer identifier. */
    readonly eventId: string
    /** Order payment code. */
    readonly code: string
    /** Direction of the bank transfer. */
    readonly transferType: string
    /** Amount in minor units. */
    readonly transferAmount: number
    /** Bank reference retained on settlement. */
    readonly referenceCode: string
}

/** Validates the transfer fields before dispatching settlement. */
const isBankTransferReceivedPayload = (
    payload: Record<string, unknown>,
): payload is Record<string, unknown> & BankTransferReceivedPayload =>
    typeof payload.eventId === "string" &&
    typeof payload.code === "string" &&
    typeof payload.transferType === "string" &&
    typeof payload.transferAmount === "number" &&
    typeof payload.referenceCode === "string"

/** Receipt committed: the billing reactor can now settle this transfer. */
export class BankTransferReceivedEvent extends BaseEvent {
    static readonly eventName = "billing.bank-transfer-received"
    static readonly version = 1
    readonly eventName = BankTransferReceivedEvent.eventName

    private constructor(
        readonly eventId: string,
        readonly payload: BankTransferReceivedPayload,
    ) {
        super()
    }

    /** Copies only the receipt contract, including a DTO's computed provider identifier. */
    static create(notice: BankTransferReceivedPayload): BankTransferReceivedEvent {
        const { eventId, code, transferType, transferAmount, referenceCode } = notice
        return new BankTransferReceivedEvent(eventId, { eventId, code, transferType, transferAmount, referenceCode })
    }

    /** Reads and validates a persisted delivery envelope. */
    static parse(envelope: unknown): ParsedEvent<BankTransferReceivedEvent> {
        return readEventOf(
            envelope,
            isBankTransferReceivedPayload,
            (eventId, payload) => new BankTransferReceivedEvent(eventId, payload),
        )
    }
}
