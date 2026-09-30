/** A typed queue: its name, how many deliveries a message gets, the base of the backoff between them, and how a stored payload is read back. */
export interface QueueDefinition<Payload extends object> {
    /** The queue name, `<owner>.<what>`. */
    readonly name: string
    /** The most deliveries one message gets before it is buried. */
    readonly attempts: number
    /** The pause after the first failed delivery; it doubles with every further failure. */
    readonly backoffMs: number
    /** Reads a stored payload back; null when it does not have the expected shape. */
    parse(value: unknown): ParsedPayloadResult<Payload>
}

/** A message as a consumer receives it. */
export interface ConsumedMessage<Payload extends object> {
    /** The stored row id. */
    readonly id: string
    /** The stable event id. */
    readonly eventId: string
    /** The parsed payload. */
    readonly payload: Payload
    /** How many deliveries were started, this one included. */
    readonly attempt: number
}

/** What reading a stored payload back answers: the payload, or null when it does not have the expected shape. */
export type ParsedPayloadResult<Payload extends object> = Payload | null
