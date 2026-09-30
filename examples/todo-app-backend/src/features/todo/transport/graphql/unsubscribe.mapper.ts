import type { UnsubscribedChannel, UnsubscribeRequest } from "../../application/unsubscribe.contracts"
import type { UnsubscribeInput } from "./dto/unsubscribe.input"
import type { UnsubscribeType } from "./dto/unsubscribe.type"

/** Maps the GraphQL input to the command request. */
export const toUnsubscribeRequest = (input: UnsubscribeInput): UnsubscribeRequest => ({ channel: input.channel })

/** Maps the unsubscribed channel to the GraphQL type. */
export const toUnsubscribeType = (unsubscribed: UnsubscribedChannel): UnsubscribeType => ({
    channel: unsubscribed.channel,
    unsubscribed: unsubscribed.unsubscribed,
})
