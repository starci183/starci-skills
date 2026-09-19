import {
    Test 
} from "@nestjs/testing"
import {
    PlatformEventBus 
} from "./event-bus.providers"
import {
    PlatformEventsModule 
} from "./events.module"
import {
    TaskCreatedEvent,
} from "./events.types"

describe("PlatformEventsModule",
    () => {
        it("register() provides and exports PlatformEventBus through the dynamic module",
            () => {
                const module = PlatformEventsModule.register()

                expect(module.module).toBe(PlatformEventsModule)
                expect(module.providers).toContain(PlatformEventBus)
                expect(module.exports).toContain(PlatformEventBus)
            })

        it("register() defaults to non-global and honors the isGlobal extra",
            () => {
                expect(PlatformEventsModule.register().global).toBeFalsy()
                expect(PlatformEventsModule.register({
                    isGlobal: true 
                }).global).toBe(true)
            })

        it("resolves a working bus from the Nest container when imported",
            async () => {
                const moduleRef = await Test.createTestingModule({
                    imports: [PlatformEventsModule.register()],
                }).compile()
                try {
                    const bus = moduleRef.get(PlatformEventBus)
                    const received: Array<unknown> = []
                    bus.subscribe(event => received.push(event))
                    const event = new TaskCreatedEvent("task-1",
                        "owner-1",
                        new Date(),
                        "src-1")
                    bus.publish(event)
                    expect(received).toEqual([event])
                } finally {
                    await moduleRef.close()
                }
            })
    })
