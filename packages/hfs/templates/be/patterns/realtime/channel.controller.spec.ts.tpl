import { METHOD_METADATA, PATH_METADATA, SSE_METADATA } from "@nestjs/common/constants"
import type { MessageEvent } from "@nestjs/common"
import { RequestMethod } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { Observable } from "rxjs"
import { @@service@@ } from "@@serviceModule@@"
import type { Principal } from "@modules/platform/cqrs"
import { REALTIME_HUB } from "@modules/platform/realtime"
import type { RealtimeHub, RealtimeSubscribeOptions, RealtimeTopic } from "@modules/platform/realtime"
import { @@Channel@@Controller } from "./@@channel@@.controller"

const principal: Principal = { id: "p-1", role: "authenticated" }
/** One event of the channel: replace the data with the real frame; its `id` is the domain event id. */
const EVENT: MessageEvent = { id: "x-1", data: { id: "x-1" } }

/** A recording hub whose event stream yields one event and records the topic, the resume point and the release. */
const hubAnswering = () => {
    const streamed: Array<{ readonly topic: string; readonly after: string | undefined }> = []
    const released: Array<string> = []
    const hub: RealtimeHub = {
        publish: () => undefined,
        subscribe: () => ({ [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ done: true, value: undefined }) }) }),
        subscriberCount: () => 0,
        stream: <T extends { readonly id: string }>(topic: RealtimeTopic<T>, options?: RealtimeSubscribeOptions) => {
            streamed.push({ topic: topic.name, after: options?.after })
            return new Observable<MessageEvent>((subscriber) => {
                subscriber.next(EVENT)
                return () => {
                    released.push(topic.name)
                }
            })
        },
    }
    return { hub, streamed, released }
}

const build = async (hub: RealtimeHub) => {
    const moduleRef = await Test.createTestingModule({
        controllers: [@@Channel@@Controller],
        providers: [{ provide: REALTIME_HUB, useValue: hub }],
    }).compile()
    return moduleRef.get(@@Channel@@Controller)
}

describe("@@Channel@@Controller", () => {
    it("streams the topic built only from the authenticated principal", async () => {
        const { hub, streamed } = hubAnswering()
        const door = await build(hub)

        door.stream(principal, undefined).subscribe().unsubscribe()

        expect(streamed).toEqual([{ topic: @@service@@(principal.id).name, after: undefined }])
    })

    it("isolates another authenticated principal's topic", async () => {
        const { hub, streamed } = hubAnswering()
        const door = await build(hub)

        door.stream({ id: "p-2", role: "authenticated" }, undefined).subscribe().unsubscribe()

        expect(streamed.map((entry) => entry.topic)).toEqual([@@service@@("p-2").name])
        expect(streamed.map((entry) => entry.topic)).not.toContain(@@service@@(principal.id).name)
    })

    it("resumes after the Last-Event-ID inside the caller's own topic", async () => {
        const { hub, streamed } = hubAnswering()
        const door = await build(hub)

        door.stream(principal, "x-0").subscribe().unsubscribe()

        expect(streamed).toEqual([{ topic: @@service@@(principal.id).name, after: "x-0" }])
    })

    it("hands the events of the hub to the response as they are", async () => {
        const { hub } = hubAnswering()
        const door = await build(hub)
        const received: Array<MessageEvent> = []

        door.stream(principal, undefined).subscribe((event) => received.push(event)).unsubscribe()

        expect(received).toEqual([EVENT])
    })

    it("releases the hub stream when the client disconnects", async () => {
        const { hub, released } = hubAnswering()
        const door = await build(hub)

        door.stream(principal, undefined).subscribe().unsubscribe()

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
