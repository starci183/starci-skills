/** A named channel of frames of one type: the one object a reactor publishes to and a door subscribes to, built by the owning domain contract. */
export interface RealtimeTopic<T extends object> {
    /** The channel name, unique per owner and scope (for example `order-status:<buyer>:<order>`). */
    readonly name: string
    /** True when a value is a frame of this topic; a value that is not one is never delivered. */
    accepts(frame: unknown): frame is T
}

/** The push hub of the realtime kind: a reactor publishes a frame to a topic, a realtime door subscribes a client to a topic. */
export interface RealtimeHub {
    /** Pushes one frame to every subscription of the topic open now. A topic with no listener drops the frame. */
    publish<T extends object>(topic: RealtimeTopic<T>, frame: T): void
    /** The frames pushed to the topic from the moment the returned stream is first read until the client stops reading it. */
    subscribe<T extends object>(topic: RealtimeTopic<T>): AsyncIterable<T>
    /** How many subscriptions of the topic are open now. */
    subscriberCount(topic: RealtimeTopic<object>): number
}
