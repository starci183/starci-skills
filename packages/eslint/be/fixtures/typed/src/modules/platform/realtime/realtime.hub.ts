/** Fixture: the push hub of the realtime kind (publish to a topic, subscribe to a topic). */
export class RealtimeHub {
    publish(_topic: string, _payload: object): void {}
    subscribe(_topic: string): AsyncIterable<object> {
        return { [Symbol.asyncIterator]: () => ({ next: async () => ({ done: true as const, value: undefined }) }) }
    }
}
