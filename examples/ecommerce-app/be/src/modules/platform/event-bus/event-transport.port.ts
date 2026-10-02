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

/** A header value of a message as the driver hands it over: text or binary, one or a list per name. */
export type KafkaMessageHeaders = Readonly<Record<string, Buffer | string | Array<Buffer | string> | undefined>>

/** The settings the module hands the factory when it builds the driver of the app. */
export interface KafkaDriverConfig {
    /** The client id the broker sees: the consumer group of the app. */
    readonly clientId: string
    /** The broker addresses. */
    readonly brokers: ReadonlyArray<string>
    /** How long connecting may take, in milliseconds. */
    readonly connectionTimeout: number
    /** How long a broker request may take, in milliseconds. */
    readonly requestTimeout: number
}

/** One message of a batch the producer appends. */
export interface KafkaBatchMessage {
    /** The partition key. */
    readonly key?: Buffer | string | null
    /** The serialized value. */
    readonly value: Buffer | string | null
    /** The headers. */
    readonly headers?: KafkaMessageHeaders
}

/** The producer as the transport uses it. */
export interface KafkaProducer {
    /** Opens the connection to the brokers. */
    connect(): Promise<void>
    /** Appends the grouped messages to their topics in one batch. */
    sendBatch(batch: { topicMessages: Array<{ topic: string; messages: Array<KafkaBatchMessage> }> }): Promise<unknown>
    /** Closes the connection. */
    disconnect(): Promise<void>
}

/** What a consumer of a topic reads from; either one topic or a list of them. */
export type KafkaConsumerSubscription =
    | { readonly topics: Array<string>; readonly fromBeginning?: boolean }
    | { readonly topic: string; readonly fromBeginning?: boolean }

/** A message as the driver hands it to the eachMessage callback. */
export interface KafkaConsumedMessage {
    /** The topic the message was read from. */
    readonly topic: string
    /** The partition. */
    readonly partition: number
    /** The record. */
    readonly message: {
        /** The offset on the partition, as text. */
        readonly offset: string
        /** The partition key. */
        readonly key: Buffer | null
        /** The serialized value. */
        readonly value: Buffer | null
        /** The headers; a message of the old wire format has none. */
        readonly headers?: KafkaMessageHeaders
    }
}

/** The callbacks a consumer runs per message; the only one the transport sets. */
export interface KafkaConsumerRun {
    /** Handles one message. */
    eachMessage?(payload: KafkaConsumedMessage): Promise<void>
}

/** The consumer as the transport uses it. */
export interface KafkaConsumer {
    /** Opens the connection and joins the group. */
    connect(): Promise<void>
    /** Subscribes to the topics. */
    subscribe(subscription: KafkaConsumerSubscription): Promise<void>
    /** Starts delivering messages. */
    run(config: KafkaConsumerRun): Promise<void>
    /** Leaves the group and closes the connection. */
    disconnect(): Promise<void>
}

/** The end offsets of one partition as the broker answers them. */
export interface KafkaPartitionOffsets {
    /** The partition. */
    readonly partition: number
    /** The offset of the latest record, as text. */
    readonly offset: string
    /** The log start offset, as text. */
    readonly low: string
    /** The log end offset, as text. */
    readonly high: string
}

/** The offsets a consumer group committed on one topic. */
export interface KafkaGroupOffsets {
    /** The topic. */
    readonly topic: string
    /** The committed offset per partition. */
    readonly partitions: Array<{
        readonly partition: number
        readonly offset: string
        readonly metadata: string | null
    }>
}

/** The admin client as the transport uses it. */
export interface KafkaAdmin {
    /** Opens the connection. */
    connect(): Promise<void>
    /** Closes the connection. */
    disconnect(): Promise<void>
    /** The topics the broker knows. */
    listTopics(): Promise<Array<string>>
    /** The end offsets of every partition of the topic. */
    fetchTopicOffsets(topic: string): Promise<Array<KafkaPartitionOffsets>>
    /** The offsets the group committed on the topics. */
    fetchOffsets(options: {
        readonly groupId: string
        readonly topics?: Array<string>
    }): Promise<Array<KafkaGroupOffsets>>
    /** Deletes the consumer groups. */
    deleteGroups(groupIds: Array<string>): Promise<Array<unknown>>
}

/** The driver of the brokers: the minimal shape of the library object the client uses, so the client never imports it. */
export interface KafkaDriver {
    /** The producer of the app. */
    producer(options: { readonly allowAutoTopicCreation?: boolean }): KafkaProducer
    /** A consumer of a group. */
    consumer(options: { readonly groupId: string; readonly allowAutoTopicCreation?: boolean }): KafkaConsumer
    /** The admin client. */
    admin(): KafkaAdmin
}

/** Builds the Kafka driver; the module provides it so a spec can double it through the injection token. */
export interface KafkaFactory {
    /** The driver over the brokers the config names. */
    create(config: KafkaDriverConfig): KafkaDriver
}
