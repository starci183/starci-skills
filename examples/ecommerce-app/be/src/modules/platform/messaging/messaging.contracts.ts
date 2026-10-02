/** A queue as its publisher knows it: its name (the event name of the vendored contract), how many deliveries a message gets and the base of the backoff between them. */
export interface QueueSpec {
    /** The queue name, `<owner>.<what>`: the event name its publisher declares in `be/contracts/<service>/events.json`. */
    readonly name: string
    /** The most deliveries one message gets before it is buried in the dead letters. */
    readonly attempts: number
    /** The pause after the first failed delivery; it doubles with every further failure. */
    readonly backoffMs: number
}

/** A queue as its consumer knows it: the spec plus how a stored payload is read back. */
export interface QueueDefinition<Payload extends object> extends QueueSpec {
    /** Reads a stored payload back; null when it does not have the expected shape. */
    parse(value: unknown): ParsedPayloadResult<Payload>
}

/** What reading a stored payload back answers: the payload, or null when it does not have the expected shape. */
export type ParsedPayloadResult<Payload extends object> = Payload | null

/** One message to publish: its queue, the stable event id the receiver dedupes on, and the payload. */
export interface PublishedMessage<Payload extends object> {
    /** The queue. */
    readonly queue: QueueSpec
    /** The stable event id: the same logical event always carries the same id, whatever the number of publications. */
    readonly eventId: string
    /** The payload. */
    readonly payload: Payload
}

/** A message as a consumer receives it. */
export interface ConsumedMessage<Payload extends object> {
    /** The id of the delivered job. */
    readonly id: string
    /** The stable event id. */
    readonly eventId: string
    /** The parsed payload. */
    readonly payload: Payload
    /** How many deliveries were started, this one included. */
    readonly attempt: number
}

/** A message that ran out of attempts and waits for an operator. */
export interface DeadLetter {
    /** The id of the failed job. */
    readonly id: string
    /** The stable event id. */
    readonly eventId: string
    /** Why the last delivery failed. */
    readonly reason: string
    /** How many deliveries were tried. */
    readonly attempts: number
}
