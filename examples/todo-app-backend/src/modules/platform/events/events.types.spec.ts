import {
    NewDeviceSigninEvent,
    SignedInEvent,
    SignedOutEvent,
    TaskCompletedEvent,
    TaskCreatedEvent,
    TaskDeletedEvent,
} from "./events.types"

/**
 * The bus spec proves delivery; this spec pins the payload contract itself - the `kind` discriminant
 * every subscriber narrows on and the fields each declared work/event record commits to carrying, so a
 * constructor that silently drops a field fails here even though publish/subscribe still works.
 */
describe("platform event payloads",
    () => {
        const at = new Date("2026-09-19T10:00:00.000Z")

        it("TaskCreatedEvent stamps event.task.created and stores its declared fields",
            () => {
                const event = new TaskCreatedEvent("task-1",
                    "owner-1",
                    at,
                    "src-1")

                expect(event).toMatchObject({
                    kind: "event.task.created",
                    taskId: "task-1",
                    ownerId: "owner-1",
                    createdAt: at,
                    sourceEventId: "src-1",
                })
            })

        it("TaskCompletedEvent stamps event.task.completed and stores its declared fields",
            () => {
                const event = new TaskCompletedEvent("task-1",
                    "owner-1",
                    at,
                    "src-2")

                expect(event).toMatchObject({
                    kind: "event.task.completed",
                    taskId: "task-1",
                    ownerId: "owner-1",
                    completedAt: at,
                    sourceEventId: "src-2",
                })
            })

        it("TaskDeletedEvent stamps event.task.deleted and stores its declared fields",
            () => {
                const event = new TaskDeletedEvent("task-1",
                    "owner-1",
                    at,
                    "src-3")

                expect(event).toMatchObject({
                    kind: "event.task.deleted",
                    taskId: "task-1",
                    ownerId: "owner-1",
                    deletedAt: at,
                    sourceEventId: "src-3",
                })
            })

        it("SignedInEvent stamps event.login.signed-in and stores its declared fields",
            () => {
                const event = new SignedInEvent("person-1",
                    at,
                    "src-4")

                expect(event).toMatchObject({
                    kind: "event.login.signed-in",
                    personId: "person-1",
                    signedInAt: at,
                    sourceEventId: "src-4",
                })
            })

        it("SignedOutEvent stamps event.login.signed-out and stores its declared fields",
            () => {
                const event = new SignedOutEvent("person-1",
                    at,
                    "src-5")

                expect(event).toMatchObject({
                    kind: "event.login.signed-out",
                    personId: "person-1",
                    signedOutAt: at,
                    sourceEventId: "src-5",
                })
            })

        it("NewDeviceSigninEvent stamps event.login.new-device-signin and stores its declared fields",
            () => {
                const event = new NewDeviceSigninEvent("person-1",
                    "device-9",
                    at,
                    "src-6")

                expect(event).toMatchObject({
                    kind: "event.login.new-device-signin",
                    personId: "person-1",
                    deviceId: "device-9",
                    signedInAt: at,
                    sourceEventId: "src-6",
                })
            })

        it("every event class exposes a distinct kind discriminant",
            () => {
                const kinds = [
                    new TaskCreatedEvent("t",
                        "o",
                        at,
                        "s").kind,
                    new TaskCompletedEvent("t",
                        "o",
                        at,
                        "s").kind,
                    new TaskDeletedEvent("t",
                        "o",
                        at,
                        "s").kind,
                    new SignedInEvent("p",
                        at,
                        "s").kind,
                    new SignedOutEvent("p",
                        at,
                        "s").kind,
                    new NewDeviceSigninEvent("p",
                        "d",
                        at,
                        "s").kind,
                ]

                expect(new Set(kinds).size).toBe(kinds.length)
            })
    })
