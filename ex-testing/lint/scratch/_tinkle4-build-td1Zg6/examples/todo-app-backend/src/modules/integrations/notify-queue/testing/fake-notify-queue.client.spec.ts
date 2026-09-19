import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    NotifyQueuePort 
} from "../notify-queue.contracts"
import {
    FakeNotifyQueueClient 
} from "./fake-notify-queue.client"

/** The fake is what every notify spec substitutes for the Redis client, so its "enqueue replaces,
 * dequeueDue removes atomically" contract is pinned here against the real port's documented semantics. */
describe("FakeNotifyQueueClient",
    () => {
        let moduleRef: TestingModule
        let fake: FakeNotifyQueueClient
        let port: NotifyQueuePort

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [FakeNotifyQueueClient,
                    {
                        provide: NotifyQueuePort, useExisting: FakeNotifyQueueClient 
                    }],
            }).compile()
            fake = moduleRef.get(FakeNotifyQueueClient)
            port = moduleRef.get(NotifyQueuePort)
        })

        afterEach(() => moduleRef.close())

        it("is the instance the port token resolves to",
            () => {
                expect(port).toBe(fake)
            })

        it("returns only the jobs due at or before now, and removes each job it returns",
            async () => {
                await fake.enqueue("job-early",
                    100)
                await fake.enqueue("job-late",
                    200)

                await expect(fake.dequeueDue(150)).resolves.toEqual(["job-early"])
                await expect(fake.dequeueDue(150)).resolves.toEqual([])
                await expect(fake.dequeueDue(200)).resolves.toEqual(["job-late"])
                await expect(fake.dequeueDue(200)).resolves.toEqual([])
            })

        it("re-enqueueing a job id replaces its due time instead of duplicating the member",
            async () => {
                await fake.enqueue("job-1",
                    100)
                await fake.enqueue("job-1",
                    500)

                await expect(fake.dequeueDue(200)).resolves.toEqual([])
                await expect(fake.dequeueDue(500)).resolves.toEqual(["job-1"])
            })

        it("has() reports a job as queued until it is dequeued",
            async () => {
                await fake.enqueue("job-1",
                    100)
                expect(fake.has("job-1")).toBe(true)
                expect(fake.has("job-2")).toBe(false)

                await fake.dequeueDue(100)
                expect(fake.has("job-1")).toBe(false)
            })
    })
