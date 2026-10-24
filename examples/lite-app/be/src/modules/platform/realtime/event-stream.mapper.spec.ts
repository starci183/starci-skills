import type { MessageEvent } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { HEARTBEAT_MS, RECONNECT_MS, eventStream } from "./event-stream.mapper"
import type { EventFrame } from "./realtime.port"

interface Frame extends EventFrame {
    readonly status: string
}

const SUBJECT: unique symbol = Symbol("realtime.event-stream")

const buildSubject = async () => {
    const functions = { eventStream }
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: () => functions }],
    }).compile()
    return moduleRef.get<typeof functions>(SUBJECT)
}

/** A stream the test feeds by hand, so it decides when a frame arrives and when the stream ends or fails. */
const controlled = (withReturn: boolean) => {
    const queue: Array<IteratorResult<Frame>> = []
    let wake: (() => void) | undefined
    let failure: Error | undefined
    const returned = jest.fn(() => Promise.resolve<IteratorResult<Frame>>({ done: true, value: undefined }))
    const iterator: AsyncIterator<Frame> = {
        next: async () => {
            while (queue.length === 0 && failure === undefined) {
                await new Promise<void>((resolve) => {
                    wake = resolve
                })
            }
            if (failure !== undefined) return Promise.reject(failure)
            return queue.shift() ?? { done: true, value: undefined }
        },
        ...(withReturn ? { return: returned } : {}),
    }
    return {
        frames: { [Symbol.asyncIterator]: () => iterator } satisfies AsyncIterable<Frame>,
        push: (frame: Frame) => {
            queue.push({ done: false, value: frame })
            wake?.()
        },
        end: () => {
            queue.push({ done: true, value: undefined })
            wake?.()
        },
        fail: (error: Error) => {
            failure = error
            wake?.()
        },
        returned,
    }
}

/** How the response ended: completed, or failed with an error. */
interface StreamState {
    completed: boolean
    error: unknown
}

/** Subscribes like Nest does and records what the response would write. */
const listen = (stream: ReturnType<typeof eventStream>) => {
    const events: Array<MessageEvent> = []
    const state: StreamState = { completed: false, error: undefined }
    const subscription = stream.subscribe({
        next: (event) => events.push(event),
        error: (error: unknown) => {
            state.error = error
        },
        complete: () => {
            state.completed = true
        },
    })
    return { events, state, subscription }
}

describe("eventStream", () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    it("opens with the reconnect delay, writes one event per frame with the frame id and completes when the stream ends", async () => {
        const subject = await buildSubject()
        const source = controlled(true)
        const { events, state } = listen(subject.eventStream(source.frames))
        expect(events).toEqual([{ retry: RECONNECT_MS, comment: "open" }])

        source.push({ id: "b-1:confirmed", status: "confirmed" })
        source.push({ id: "b-2:confirmed", status: "confirmed" })
        source.end()
        await jest.advanceTimersByTimeAsync(0)

        expect(events.slice(1)).toEqual([
            { id: "b-1:confirmed", data: { id: "b-1:confirmed", status: "confirmed" } },
            { id: "b-2:confirmed", data: { id: "b-2:confirmed", status: "confirmed" } },
        ])
        expect(state.completed).toBe(true)
        expect(jest.getTimerCount()).toBe(0)
    })

    it("writes a comment heartbeat every HEARTBEAT_MS while the channel is idle", async () => {
        const subject = await buildSubject()
        const source = controlled(true)
        const { events, subscription } = listen(subject.eventStream(source.frames))

        await jest.advanceTimersByTimeAsync(HEARTBEAT_MS - 1)
        expect(events).toHaveLength(1)
        await jest.advanceTimersByTimeAsync(1)
        await jest.advanceTimersByTimeAsync(HEARTBEAT_MS)

        expect(events.slice(1)).toEqual([{ comment: "heartbeat" }, { comment: "heartbeat" }])
        subscription.unsubscribe()
    })

    it("takes the heartbeat period it is given", async () => {
        const subject = await buildSubject()
        const source = controlled(true)
        const { events, subscription } = listen(subject.eventStream(source.frames, 50))

        await jest.advanceTimersByTimeAsync(100)

        expect(events.slice(1)).toEqual([{ comment: "heartbeat" }, { comment: "heartbeat" }])
        subscription.unsubscribe()
    })
})

describe("eventStream disconnects and failures", () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    it("stops the heartbeat and returns the hub iterator when the client disconnects", async () => {
        const subject = await buildSubject()
        const source = controlled(true)
        const { subscription } = listen(subject.eventStream(source.frames))

        subscription.unsubscribe()

        expect(source.returned).toHaveBeenCalledTimes(1)
        expect(jest.getTimerCount()).toBe(0)
    })

    it("lets a client disconnect from a stream whose iterator has no return", async () => {
        const subject = await buildSubject()
        const source = controlled(false)
        const { subscription } = listen(subject.eventStream(source.frames))

        subscription.unsubscribe()

        expect(source.returned).not.toHaveBeenCalled()
        expect(jest.getTimerCount()).toBe(0)
    })

    it("forwards a failure of the hub stream as an error of the response", async () => {
        const subject = await buildSubject()
        const source = controlled(true)
        const { state } = listen(subject.eventStream(source.frames))
        const failure = new Error("hub failed")

        source.fail(failure)
        await jest.advanceTimersByTimeAsync(0)

        expect(state.error).toBe(failure)
        expect(state.completed).toBe(false)
        expect(jest.getTimerCount()).toBe(0)
    })
})
