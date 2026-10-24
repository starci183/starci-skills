import { METHOD_METADATA, PATH_METADATA, SSE_METADATA } from "@nestjs/common/constants"
import type { MessageEvent } from "@nestjs/common"
import { RequestMethod } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { @@service@@ } from "@@serviceModule@@"
import type { Principal } from "@modules/platform/cqrs"
import { REALTIME_HUB } from "@modules/platform/realtime"
import type { RealtimeHub, RealtimeSubscribeOptions, RealtimeTopic } from "@modules/platform/realtime"
import { @@Channel@@Controller } from "./@@channel@@.controller"

const principal: Principal = { id: "p-1", role: "authenticated" }
/** A frame the topic of the domain contract accepts: replace the shape with the real frame of the channel; its `id` is the domain event id. */
const FRAME = { id: "x-1" }

/** A recording hub whose stream yields one frame, then waits until the transport returns its iterator. */
const hubAnswering = () => {
    const subscribed: Array<{ readonly topic: string; readonly after: string | undefined }> = []
    const released: Array<string> = []
    const hub: RealtimeHub = {
        publish: () => undefined,
        subscriberCount: () => 0,
        subscribe: <T extends object>(topic: RealtimeTopic<T>, options?: RealtimeSubscribeOptions): AsyncIterable<T> => {
            subscribed.push({ topic: topic.name, after: options?.after })
            let release: () => void = () => undefined
            const closed = new Promise<void>((resolve) => { release = resolve })
            let sent = false
            return {
                [Symbol.asyncIterator]: () => ({
                    next: async (): Promise<IteratorResult<T>> => {
                        if (!sent && topic.accepts(FRAME)) {
                            sent = true
                            return { done: false, value: FRAME }
                        }
                        await closed
                        return { done: true, value: undefined }
                    },
                    return: async (): Promise<IteratorResult<T>> => {
                        released.push(topic.name)
                        release()
                        return { done: true, value: undefined }
                    },
                }),
            }
        },
    }
    return { hub, subscribed, released }
}

const build = async (hub: RealtimeHub) => {
    const moduleRef = await Test.createTestingModule({
        controllers: [@@Channel@@Controller],
        providers: [{ provide: REALTIME_HUB, useValue: hub }],
    }).compile()
    return moduleRef.get(@@Channel@@Controller)
}

/** Subscribes like Nest does and resolves with the first event that carries data. */
const firstData = (door: @@Channel@@Controller, caller: Principal, lastEventId?: string) =>
    new Promise<{ event: MessageEvent; disconnect: () => void }>((resolve) => {
        const subscription = door.stream(caller, lastEventId).subscribe((event) => {
            if (event.data !== undefined) resolve({ event, disconnect: () => subscription.unsubscribe() })
        })
    })

describe("@@Channel@@Controller", () => {
    it("builds the topic only from the authenticated principal", async () => {
        const { hub, subscribed } = hubAnswering()
        const door = await build(hub)

        const { disconnect } = await firstData(door, principal)

        expect(subscribed).toEqual([{ topic: @@service@@(principal.id).name, after: undefined }])
        disconnect()
    })

    it("isolates another authenticated principal's topic", async () => {
        const { hub, subscribed } = hubAnswering()
        const door = await build(hub)

        const { disconnect } = await firstData(door, { id: "p-2", role: "authenticated" })

        expect(subscribed.map((entry) => entry.topic)).toEqual([@@service@@("p-2").name])
        expect(subscribed.map((entry) => entry.topic)).not.toContain(@@service@@(principal.id).name)
        disconnect()
    })

    it("resumes after the Last-Event-ID inside the caller's own topic", async () => {
        const { hub, subscribed } = hubAnswering()
        const door = await build(hub)

        const { disconnect } = await firstData(door, principal, "x-0")

        expect(subscribed).toEqual([{ topic: @@service@@(principal.id).name, after: "x-0" }])
        disconnect()
    })

    it("pushes a hub frame as an event whose id is the domain event id", async () => {
        const { hub } = hubAnswering()
        const door = await build(hub)

        const { event, disconnect } = await firstData(door, principal)

        expect(event).toEqual({ id: FRAME.id, data: FRAME })
        disconnect()
    })

    it("releases the hub subscription when the client disconnects", async () => {
        const { hub, released } = hubAnswering()
        const door = await build(hub)

        const { disconnect } = await firstData(door, principal)
        disconnect()

        expect(released).toEqual([@@service@@(principal.id).name])
    })

    it("is one GET event stream with no other handler", async () => {
        const { hub } = hubAnswering()
        const door = await build(hub)

        expect(Reflect.getMetadata(SSE_METADATA, door.stream)).toBe(true)
        expect(Reflect.getMetadata(METHOD_METADATA, door.stream)).toBe(RequestMethod.GET)
        expect(Reflect.getMetadata(PATH_METADATA, door.stream)).toBe("stream")
        expect(Reflect.getMetadata(PATH_METADATA, @@Channel@@Controller)).toBe("@@channel@@")
        expect(Object.getOwnPropertyNames(@@Channel@@Controller.prototype)).toEqual(["constructor", "stream"])
    })
})
