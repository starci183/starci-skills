/** The answer to a SePay delivery: ignored when nothing was applied because the delivery was unauthorized or a replay, otherwise what the confirmation changed. */
export class SepayWebhookResponse {
    /** True when the delivery was ignored: an invalid signature or a replayed delivery. */
    ignored!: boolean

    /** True when this delivery activated the subscription; absent when the delivery was ignored. */
    applied?: boolean

    /** The status of the subscription afterwards; absent when the delivery was ignored. */
    subscriptionStatus?: string
}
