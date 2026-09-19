import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    NotifyEventSubscriber 
} from "./notify-event.subscriber"
import {
    NotifyService 
} from "./notify.service"
import {
    PlatformEventBus 
} from "@modules/platform/events/event-bus.providers"
import {
    SignedInEvent, TaskCompletedEvent 
} from "@modules/platform/events/events.types"

describe("NotifyEventSubscriber",
    () => {
        let moduleRef: TestingModule
        let events: PlatformEventBus
        let admit: jest.Mock

        beforeEach(async () => {
            admit = jest.fn().mockResolvedValue(undefined)
            moduleRef = await Test.createTestingModule({
                providers: [
                    NotifyEventSubscriber,
                    PlatformEventBus,
                    {
                        provide: NotifyService, useValue: {
                            admit 
                        } 
                    },
                ],
            }).compile()
            events = moduleRef.get(PlatformEventBus)
            moduleRef.get(NotifyEventSubscriber).onModuleInit()
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("event.task.completed: admits a task-complete notification with the producer-supplied sourceEventId, never an invented one",
            async () => {
                events.publish(new TaskCompletedEvent("task-1",
                    "owner-1",
                    new Date("2026-09-18T06:00:00.000Z"),
                    "evt-1"))
                await flush()

                expect(admit).toHaveBeenCalledTimes(1)
                expect(admit.mock.calls[0][0]).toEqual({
                    kind: "task-complete",
                    sourceEventId: "evt-1",
                    recipientId: "owner-1",
                    channel: "email",
                    payload: {
                        taskId: "task-1", completedAt: "2026-09-18T06:00:00.000Z" 
                    },
                })
            })

        it("event.login.signed-in: gap.notify.new-device-event - subscribing does not fabricate a new-device notification",
            async () => {
                events.publish(new SignedInEvent("person-1",
                    new Date("2026-09-18T06:00:00.000Z"),
                    "evt-2"))
                await flush()

                expect(admit).not.toHaveBeenCalled()
            })

        it("unsubscribes on destroy: a later publish reaches nothing",
            async () => {
                moduleRef.get(NotifyEventSubscriber).onModuleDestroy()

                events.publish(new TaskCompletedEvent("task-1",
                    "owner-1",
                    new Date(),
                    "evt-3"))
                await flush()

                expect(admit).not.toHaveBeenCalled()
            })
    })

function flush(): Promise<void> {
    return new Promise(resolve => setImmediate(resolve))
}
