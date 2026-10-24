/** A named channel of frames of one type: the one object a publisher pushes to and a door subscribes to, built by the owning domain contract. */
export interface RealtimeTopic<T extends object> {
    /** The channel name, unique per owner and scope (for example `booking-status:<owner>`). */
    readonly name: string
    /** True when a value is a frame of this topic; a value that is not one is never delivered. */
    accepts(frame: unknown): frame is T
}

/** What a client may ask of a subscription when it reconnects. */
export interface RealtimeSubscribeOptions {
    /**
     * The `id` of the last frame the client received (the `Last-Event-ID` of an SSE reconnect). The stream starts with the frames the
     * hub still retains after it; an id the hub no longer retains starts with every retained frame, so the client converges and
     * refetches a snapshot for anything older. Absent: live frames only.
     */
    readonly after?: string | undefined
}

/** The push hub of the realtime kind: a publisher pushes a frame to a topic, a realtime door subscribes a client to a topic. */
export interface RealtimeHub {
    /** Pushes one frame to every subscription of the topic open now, and retains it (bounded) when it carries a string `id`. */
    publish<T extends object>(topic: RealtimeTopic<T>, frame: T): void
    /** The frames pushed to the topic (after the `after` frame, when given) until the client stops reading the returned stream. */
    subscribe<T extends object>(topic: RealtimeTopic<T>, options?: RealtimeSubscribeOptions): AsyncIterable<T>
    /** How many subscriptions of the topic are open now. */
    subscriberCount(topic: RealtimeTopic<object>): number
}

/** A frame the SSE door can carry: its `id` is the domain event id, the resume point a reconnecting client names in `Last-Event-ID`. */
export interface EventFrame {
    /** The domain event id of the frame, unique within its topic. */
    readonly id: string
}
