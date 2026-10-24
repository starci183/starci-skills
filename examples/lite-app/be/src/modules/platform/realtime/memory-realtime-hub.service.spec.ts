import { Test } from "@nestjs/testing"
import { MemoryRealtimeHubService, REPLAY_FRAMES, REPLAY_TOPICS } from "./memory-realtime-hub.service"
import type { RealtimeTopic } from "./realtime.port"

interface Frame {
    readonly id: string
    readonly value: number
}

const isFrame = (value: unknown): value is Frame =>
    typeof value === "object" && value !== null && "id" in value && "value" in value

const topicOf = (name: string): RealtimeTopic<Frame> => ({ name, accepts: isFrame })

const frameOf = (value: number): Frame => ({ id: `e-${value}`, value })

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [MemoryRealtimeHubService] }).compile()
    return moduleRef.get(MemoryRealtimeHubService)
}

/** The frames a reconnect after `after` receives from the retained buffer: the stream is stopped at once and then drained. */
const replayed = async (hub: MemoryRealtimeHubService, topic: RealtimeTopic<Frame>, after: string): Promise<Array<Frame>> => {
    const iterator = hub.subscribe(topic, { after })[Symbol.asyncIterator]()
    await iterator.return?.()
    const frames: Array<Frame> = []
    for (let step = await iterator.next(); step.done !== true; step = await iterator.next()) frames.push(step.value)
    return frames
}

describe("MemoryRealtimeHubService live delivery", () => {
    it("delivers a published frame to every open subscription of the topic, in order", async () => {
        const hub = await build()
        const topic = topicOf("t:live")
        const first = hub.subscribe(topic)[Symbol.asyncIterator]()
        const second = hub.subscribe(topic)[Symbol.asyncIterator]()
        expect(hub.subscriberCount(topic)).toBe(2)

        hub.publish(topic, frameOf(1))
        hub.publish(topic, frameOf(2))

        await expect(first.next()).resolves.toEqual({ done: false, value: frameOf(1) })
        await expect(first.next()).resolves.toEqual({ done: false, value: frameOf(2) })
        await expect(second.next()).resolves.toEqual({ done: false, value: frameOf(1) })
        await first.return?.()
        await second.return?.()
    })

    it("wakes a reader that is already waiting when the frame arrives", async () => {
        const hub = await build()
        const topic = topicOf("t:wait")
        const reader = hub.subscribe(topic)[Symbol.asyncIterator]()
        const pending = reader.next()

        hub.publish(topic, frameOf(1))

        await expect(pending).resolves.toEqual({ done: false, value: frameOf(1) })
        await reader.return?.()
    })

    it("never delivers a frame of another topic or a value the topic does not accept", async () => {
        const hub = await build()
        const topic = topicOf("t:mine")
        const reader = hub.subscribe(topic)[Symbol.asyncIterator]()

        hub.publish(topicOf("t:other"), frameOf(1))
        hub.publish({ name: "t:mine", accepts: (value: unknown): value is Frame => value === "never" }, frameOf(2))
        hub.publish(topic, frameOf(3))

        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(3) })
        await reader.return?.()
    })

    it("releases a subscription when its reader stops, keeps the others and ends the stopped stream", async () => {
        const hub = await build()
        const topic = topicOf("t:release")
        const leaving = hub.subscribe(topic)[Symbol.asyncIterator]()
        const staying = hub.subscribe(topic)[Symbol.asyncIterator]()

        await leaving.return?.()
        hub.publish(topic, frameOf(1))

        expect(hub.subscriberCount(topic)).toBe(1)
        await expect(leaving.next()).resolves.toEqual({ done: true, value: undefined })
        await expect(staying.next()).resolves.toEqual({ done: false, value: frameOf(1) })
        await staying.return?.()
        expect(hub.subscriberCount(topic)).toBe(0)
    })

    it("ends a reader that is waiting when it is stopped", async () => {
        const hub = await build()
        const reader = hub.subscribe(topicOf("t:stop"))[Symbol.asyncIterator]()
        const pending = reader.next()

        await reader.return?.()

        await expect(pending).resolves.toEqual({ done: true, value: undefined })
    })

    it("counts no subscription for a topic nobody listens to", async () => {
        const hub = await build()

        expect(hub.subscriberCount(topicOf("t:nobody"))).toBe(0)
    })
})

describe("MemoryRealtimeHubService replay", () => {
    it("starts with the retained frames after the id the client names, then goes live", async () => {
        const hub = await build()
        const topic = topicOf("t:resume")
        hub.publish(topic, frameOf(1))
        hub.publish(topic, frameOf(2))
        hub.publish(topic, frameOf(3))

        const reader = hub.subscribe(topic, { after: "e-1" })[Symbol.asyncIterator]()
        hub.publish(topic, frameOf(4))

        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(2) })
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(3) })
        await expect(reader.next()).resolves.toEqual({ done: false, value: frameOf(4) })
        await reader.return?.()
    })

    it("replays every retained frame for an id the hub no longer retains", async () => {
        const hub = await build()
        const topic = topicOf("t:unknown")
        hub.publish(topic, frameOf(1))
        hub.publish(topic, frameOf(2))

        await expect(replayed(hub, topic, "e-gone")).resolves.toEqual([frameOf(1), frameOf(2)])
    })

    it("replays nothing when the topic retained nothing yet or no id is named, and goes live", async () => {
        const hub = await build()
        const topic = topicOf("t:fresh")
        const empty = hub.subscribe(topic, { after: "e-1" })[Symbol.asyncIterator]()
        hub.publish(topic, frameOf(1))
        const live = hub.subscribe(topic)[Symbol.asyncIterator]()
        hub.publish(topic, frameOf(2))

        await expect(empty.next()).resolves.toEqual({ done: false, value: frameOf(1) })
        await expect(live.next()).resolves.toEqual({ done: false, value: frameOf(2) })
        await empty.return?.()
        await live.return?.()
    })

    it("retains only a frame the topic accepts and that carries a string id", async () => {
        const hub = await build()
        const topic: RealtimeTopic<Frame> = { name: "t:ids", accepts: (value: unknown): value is Frame => isFrame(value) && value.value > 0 }
        hub.publish(topic, frameOf(0))
        hub.publish(topic, { id: 7, value: 1 } as unknown as Frame)
        hub.publish(topic, frameOf(1))

        await expect(replayed(hub, topic, "e-none")).resolves.toEqual([frameOf(1)])
    })

    it("keeps at most REPLAY_FRAMES frames of one topic, dropping the oldest", async () => {
        const hub = await build()
        const topic = topicOf("t:bounded")
        for (let value = 1; value <= REPLAY_FRAMES + 3; value += 1) hub.publish(topic, frameOf(value))

        const kept = await replayed(hub, topic, "e-none")

        expect(kept).toHaveLength(REPLAY_FRAMES)
        expect(kept[0]).toEqual(frameOf(4))
        expect(kept.at(-1)).toEqual(frameOf(REPLAY_FRAMES + 3))
    })

    it("keeps frames for at most REPLAY_TOPICS topics, dropping the topic published to least recently", async () => {
        const hub = await build()
        hub.publish(topicOf("t:first"), frameOf(1))
        for (let index = 0; index < REPLAY_TOPICS; index += 1) hub.publish(topicOf(`t:filler-${index}`), frameOf(index))

        await expect(replayed(hub, topicOf("t:first"), "e-none")).resolves.toEqual([])
        await expect(replayed(hub, topicOf(`t:filler-${REPLAY_TOPICS - 1}`), "e-none")).resolves.toEqual([frameOf(REPLAY_TOPICS - 1)])
    })
})
