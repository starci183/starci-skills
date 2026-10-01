import { createHash } from "node:crypto"
import type { Locale } from "@modules/platform/i18n"
import type { DeliveryState, DeliveryVerdict, FailureClass } from "./notify.contracts"

/** One rolling window per person per channel, this long unless the person's preference overrides it. */
export const DEFAULT_DIGEST_WINDOW_MINUTES = 10

/** A transient failure retries until this many dispatches were made, then the attempt is bounced as retries-exhausted. */
export const RETRY_BUDGET = 3

/** The pause between a transient failure and the next dispatch of the same group. */
export const RETRY_BACKOFF_MS = 30_000

/** The language of the emails: there is no stored language preference yet. */
export const EMAIL_LOCALE: Locale = "vi"

/** Where an attempt goes after one send: its next state, whether it ends there, and the failure class it records. */
export interface AttemptSettlement {
    /** The state entered. */
    readonly state: DeliveryState
    /** True for a terminal state. */
    readonly ends: boolean
    /** The failure class to record; absent keeps the recorded one. */
    readonly failureClass?: FailureClass
}

/** The dedupe key: kind, source event and recipient, never the payload, so two events with the same facts stay two. */
export const computeDedupeKey = (kind: string, sourceEventId: string, recipientId: string): string =>
    createHash("sha256").update(`${kind}:${sourceEventId}:${recipientId}`).digest("hex")

/** True when the channel has no visible character. */
export const isBlankChannel = (channel: string): boolean => channel.trim() === ""

/** True for a digest window that is a whole number of minutes of at least one. */
export const isValidDigestWindow = (minutes: number): boolean => Number.isInteger(minutes) && minutes >= 1

/** The settlement of an attempt after a send that came to `verdict` on its `attempt`-th dispatch. */
export const settleAttempt = (verdict: DeliveryVerdict, attempt: number): AttemptSettlement => {
    if (verdict === "delivered") return { state: "delivered", ends: true }
    if (verdict === "permanent-bounce") return { state: "bounced", ends: true, failureClass: "permanent-bounce" }
    if (attempt < RETRY_BUDGET) return { state: "queued", ends: false, failureClass: "transient" }
    return { state: "bounced", ends: true, failureClass: "retries-exhausted" }
}
