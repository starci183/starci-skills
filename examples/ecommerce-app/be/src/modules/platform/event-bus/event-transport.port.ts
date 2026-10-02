/** One message to put on a topic. */
export interface OutboundMessage {
    /** The topic. */
    readonly topic: string
    /** The partition key: messages of one key keep their order. */
    readonly key: string
    /** The serialized envelope. */
    readonly value: string
    /** Text headers: the attempt, the earliest redelivery instant, the failure reason. */
    readonly headers: Readonly<Record<string, string>>
}

/** One message as the transport hands it to a subscriber, with its position on the topic. */
export interface InboundMessage extends OutboundMessage {
    /** The partition. */
    readonly partition: number
    /** The offset on the partition, as text. */
    readonly offset: string
}

/** What a subscriber of the transport asks for. */
export interface EventSubscription {
    /** The topics to read. */
    readonly topics: ReadonlyArray<string>
    /** Handles one message; a return acknowledges it, a throw makes the transport deliver it again. */
    onMessage(message: InboundMessage): Promise<void>
}

/** The broker as the event bus sees it: the one port the Kafka client implements. */
export interface EventTransport {
    /** Appends the messages to their topics. */
    send(messages: ReadonlyArray<OutboundMessage>): Promise<void>
    /** Starts reading the topics for the consumer group of the service. */
    subscribe(subscription: EventSubscription): Promise<void>
    /** How many messages of the topic the consumer group of the service has not acknowledged yet. */
    lag(topic: string): Promise<number>
    /** Every message of the topic, oldest first. */
    read(topic: string): Promise<ReadonlyArray<InboundMessage>>
    /** Resolves after `ms` milliseconds: the only clock of the retry backoff and the relay loop. */
    wait(ms: number): Promise<void>
}
