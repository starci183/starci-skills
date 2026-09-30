/** Fixture: the publisher port of platform/messaging. */
export interface MessagePublisher {
    publish(message: { title: string; text: string }): Promise<void>
}
