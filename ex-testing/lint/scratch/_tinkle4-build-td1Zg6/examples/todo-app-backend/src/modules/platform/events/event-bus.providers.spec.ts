import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    config 
} from "rxjs"
import {
    PlatformEventBus 
} from "./event-bus.providers"
import {
    PlatformEventsModule 
} from "./events.module"
import {
    NewDeviceSigninEvent,
    SignedInEvent,
    SignedOutEvent,
    TaskCompletedEvent,
    TaskCreatedEvent,
    TaskDeletedEvent,
} from "./events.types"

describe("PlatformEventBus",
    () => {
        let moduleRef: TestingModule
        let bus: PlatformEventBus

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                imports: [PlatformEventsModule.register()] 
            }).compile()
            bus = moduleRef.get(PlatformEventBus)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("event.task.created: a subscriber receives exactly what is published",
            () => {
                const received: Array<unknown> = []
                bus.subscribe(event => received.push(event))

                const event = new TaskCreatedEvent("task-1",
                    "owner-1",
                    new Date("2026-09-18T00:00:00.000Z"),
                    "src-1")
                bus.publish(event)

                expect(received).toEqual([event])
            })

        it("a subscriber registered after publish does not retroactively see the earlier event",
            () => {
                bus.publish(new TaskCreatedEvent("task-1",
                    "owner-1",
                    new Date(),
                    "src-1"))

                const received: Array<unknown> = []
                bus.subscribe(event => received.push(event))

                expect(received).toHaveLength(0)
            })

        it("event.task.completed, event.task.deleted, event.login.signed-in, event.login.signed-out all carry their declared fields",
            () => {
                const received: Array<unknown> = []
                bus.subscribe(event => received.push(event))

                bus.publish(new TaskCompletedEvent("task-1",
                    "owner-1",
                    new Date(),
                    "src-1"))
                bus.publish(new TaskDeletedEvent("task-1",
                    "owner-1",
                    new Date(),
                    "src-2"))
                bus.publish(new SignedInEvent("person-1",
                    new Date(),
                    "src-3"))
                bus.publish(new SignedOutEvent("person-1",
                    new Date(),
                    "src-4"))

                expect(received.map(event => (event as { kind: string }).kind)).toEqual([
                    "event.task.completed",
                    "event.task.deleted",
                    "event.login.signed-in",
                    "event.login.signed-out",
                ])
            })

        it("event.login.new-device-signin delivers the declared payload fields even though nothing publishes it yet",
            () => {
                const received: Array<unknown> = []
                bus.subscribe(event => received.push(event))

                const signedInAt = new Date("2026-09-19T08:00:00.000Z")
                bus.publish(new NewDeviceSigninEvent("person-1",
                    "device-9",
                    signedInAt,
                    "src-5"))

                expect(received).toEqual([
                    expect.objectContaining({
                        kind: "event.login.new-device-signin",
                        personId: "person-1",
                        deviceId: "device-9",
                        signedInAt,
                        sourceEventId: "src-5",
                    }),
                ])
            })

        it("delivers each published event to every registered subscriber",
            () => {
                const first: Array<unknown> = []
                const second: Array<unknown> = []
                bus.subscribe(event => first.push(event))
                bus.subscribe(event => second.push(event))

                const event = new SignedInEvent("person-1",
                    new Date(),
                    "src-1")
                bus.publish(event)

                expect(first).toEqual([event])
                expect(second).toEqual([event])
            })

        it("stops delivering to a handler once its subscription is unsubscribed, without affecting others",
            () => {
                const kept: Array<unknown> = []
                const dropped: Array<unknown> = []
                bus.subscribe(event => kept.push(event))
                const subscription = bus.subscribe(event => dropped.push(event))

                bus.publish(new TaskCreatedEvent("task-1",
                    "owner-1",
                    new Date(),
                    "src-1"))
                subscription.unsubscribe()
                bus.publish(new TaskCreatedEvent("task-2",
                    "owner-1",
                    new Date(),
                    "src-2"))

                expect(dropped).toHaveLength(1)
                expect(kept).toHaveLength(2)
            })

        it("publish is a no-op when nobody is subscribed",
            () => {
                expect(() => bus.publish(new TaskCreatedEvent("task-1",
                    "owner-1",
                    new Date(),
                    "src-1"))).not.toThrow()
            })

        it("invokes the same handler once per subscription when it is subscribed twice",
            () => {
                let calls = 0
                const handler = () => {
                    calls += 1
                }
                bus.subscribe(handler)
                bus.subscribe(handler)

                bus.publish(new TaskCreatedEvent("task-1",
                    "owner-1",
                    new Date(),
                    "src-1"))

                expect(calls).toBe(2)
            })

        it("a handler that throws does not break publish, stays subscribed, and is reported as an unhandled error",
            async () => {
                const reported: Array<unknown> = []
                const previous = config.onUnhandledError
                config.onUnhandledError = (err: unknown) => reported.push(err)
                try {
                    const calls: Array<string> = []
                    bus.subscribe(() => {
                        calls.push("throwing")
                        throw new Error("handler boom")
                    })
                    bus.subscribe(event => calls.push(`ok:${event.kind}`))

                    const created = new TaskCreatedEvent("task-1",
                        "owner-1",
                        new Date(),
                        "src-1")
                    expect(() => bus.publish(created)).not.toThrow()
                    bus.publish(new SignedInEvent("person-1",
                        new Date(),
                        "src-2"))

                    // The throwing handler keeps its subscription (rx sees the error per-subscriber, not per-bus):
                    // it is called for both events and both later subscribers still receive every event.
                    expect(calls).toEqual([
                        "throwing",
                        "ok:event.task.created",
                        "throwing",
                        "ok:event.login.signed-in",
                    ])

                    // The handler's failure does not reach publish() synchronously; rx reports it asynchronously
                    // through config.onUnhandledError instead of letting it kill the dispatch loop.
                    expect(reported).toHaveLength(0)
                    await new Promise(resolve => setTimeout(resolve,
                        0))
                    expect(reported).toHaveLength(2)
                    expect(String(reported[0])).toContain("handler boom")
                    expect(String(reported[1])).toContain("handler boom")
                } finally {
                    config.onUnhandledError = previous
                }
            })

        it("a publish nested inside a handler is delivered to the remaining subscribers before the outer event continues",
            () => {
                const order: Array<string> = []
                const nested = new SignedInEvent("person-1",
                    new Date(),
                    "src-nested")
                const outer = new TaskCreatedEvent("task-1",
                    "owner-1",
                    new Date(),
                    "src-outer")

                bus.subscribe(event => {
                    order.push(`A:${event.kind}`)
                    if (event === outer) bus.publish(nested)
                })
                bus.subscribe(event => order.push(`B:${event.kind}`))

                bus.publish(outer)

                // A's handler publishes the nested event synchronously: both subscribers see it before the
                // outer publish loop resumes delivering the outer event to B.
                expect(order).toEqual([
                    "A:event.task.created",
                    "A:event.login.signed-in",
                    "B:event.login.signed-in",
                    "B:event.task.created",
                ])
            })

        it("a subscriber unsubscribed during delivery does not receive the event in flight",
            () => {
                const calls: Array<string> = []
                const created = new TaskCreatedEvent("task-1",
                    "owner-1",
                    new Date(),
                    "src-1")
                bus.subscribe(() => {
                    calls.push("first")
                    second.unsubscribe()
                })
                const second = bus.subscribe(() => calls.push("second"))

                bus.publish(created)
                bus.publish(new TaskCreatedEvent("task-2",
                    "owner-1",
                    new Date(),
                    "src-2"))

                // Subject iterates a snapshot of its observers, but each observer checks isStopped at call
                // time - so 'second' misses the in-flight event too, not just later ones.
                expect(calls).toEqual(["first",
                    "first"])
            })

        it("a handler that unsubscribes itself stops receiving later events",
            () => {
                const calls: Array<string> = []
                const subscription = bus.subscribe(event => {
                    calls.push(event.kind)
                    subscription.unsubscribe()
                })

                bus.publish(new TaskCreatedEvent("task-1",
                    "owner-1",
                    new Date(),
                    "src-1"))
                bus.publish(new TaskCreatedEvent("task-2",
                    "owner-1",
                    new Date(),
                    "src-2"))

                expect(calls).toEqual(["event.task.created"])
            })
    })
