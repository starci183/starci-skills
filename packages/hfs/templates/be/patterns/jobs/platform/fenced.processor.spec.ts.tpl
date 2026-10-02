import type { ClaimedJob } from "./jobs.contracts"
import { FencedProcessor } from "./fenced.processor"

const claimedJob: ClaimedJob = {
    jobId: "job-1",
    kind: "mail",
    fencingToken: 3,
    currentStep: null,
    payload: { messageId: "message-1" },
}

class MailProcessor extends FencedProcessor {
    readonly queue = "mail"
    readonly processed: Array<ClaimedJob> = []

    process(job: ClaimedJob): Promise<void> {
        this.processed.push(job)
        return Promise.resolve()
    }
}

describe("FencedProcessor", () => {
    it("lets a processor declare its queue and process a claimed job", async () => {
        const processor = new MailProcessor()

        await processor.process(claimedJob)

        expect(processor.queue).toBe("mail")
        expect(processor.processed).toEqual([claimedJob])
    })
})
