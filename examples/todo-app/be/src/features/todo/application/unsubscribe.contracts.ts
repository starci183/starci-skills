import type { NotifyErrorCode } from "@modules/domain/notify"
import type { Outcome } from "@modules/platform/primitives"

/** What unsubscribing takes: the channel to stop receiving on. */
export interface UnsubscribeRequest {
    /** The channel. */
    readonly channel: string
}

/** The channel the caller is now unsubscribed from. */
export interface UnsubscribedChannel {
    /** The channel. */
    readonly channel: string
    /** Always true: the caller is unsubscribed. */
    readonly unsubscribed: true
}

/** The channel the caller is now unsubscribed from, or the refusal that names why nothing was written. */
export type UnsubscribeResult = Outcome<UnsubscribedChannel, NotifyErrorCode>
