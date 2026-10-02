import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { @@service@@ } from "@@serviceModule@@"
import { REALTIME_HUB } from "@modules/platform/realtime"
import type { RealtimeHub, RealtimeTopic } from "@modules/platform/realtime"
import { @@Channel@@Subscription } from "./@@channel@@.subscription"

const emptyStream = (): AsyncIterable<never> => (async function* () {})()

/** A hub whose subscribe records the names of the topics it was asked for and answers one stream. */
const hubAnswering = (stream: AsyncIterable<never>) => {
    const topics: Array<string> = []
    const hub = mock<RealtimeHub>({
        subscribe: <T extends object>(topic: RealtimeTopic<T>): AsyncIterable<T> => {
            topics.push(topic.name)
            return stream
        },
    })
    return { hub, topics }
}

const build = async (hub: RealtimeHub) => {
    const moduleRef = await Test.createTestingModule({
        providers: [@@Channel@@Subscription, { provide: REALTIME_HUB, useValue: hub }],
    }).compile()
    return moduleRef.get(@@Channel@@Subscription)
}

describe("@@Channel@@Subscription", () => {
    describe("@@channelCamel@@Changed", () => {
        it("subscribes the client to the topic of its own principal and returns the hub stream", async () => {
            const frames = emptyStream()
            const { hub, topics } = hubAnswering(frames)
            const door = await build(hub)

            const stream = door.@@channelCamel@@Changed({ id: "p-1", roles: ["member"] }, { id: "x-1" })

            expect(stream).toBe(frames)
            expect(topics).toEqual([@@service@@("p-1", "x-1").name])
        })

        it("subscribes another principal to another topic, so it cannot receive the first one's frames", async () => {
            const { hub, topics } = hubAnswering(emptyStream())
            const door = await build(hub)

            door.@@channelCamel@@Changed({ id: "p-2", roles: ["member"] }, { id: "x-1" })

            expect(topics).not.toContain(@@service@@("p-1", "x-1").name)
        })
    })
})
