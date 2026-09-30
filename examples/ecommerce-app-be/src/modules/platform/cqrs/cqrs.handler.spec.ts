import { mock } from "@starci/jest-preset/mock"
import type { Logger } from "@modules/platform/logging"
import { ICQRSHandler } from "./cqrs.handler"
import { CqrsLogEvent } from "./cqrs.log-events"

class EchoHandler extends ICQRSHandler<string, string> {
    protected override async process(message: string): Promise<string> {
        if (message === "boom") return Promise.reject(new TypeError("boom"))
        return message
    }
}

describe("ICQRSHandler", () => {
    it("returns what process answers", async () => {
        const logger = mock<Logger>()
        await expect(new EchoHandler(logger).execute("hi")).resolves.toBe("hi")
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("logs OperationFailed with the operation name and rethrows", async () => {
        const logger = mock<Logger>()
        await expect(new EchoHandler(logger).execute("boom")).rejects.toThrow(TypeError)
        expect(logger.error).toHaveBeenCalledWith(CqrsLogEvent.OperationFailed, expect.any(TypeError), {
            operation: "EchoHandler",
        })
    })
})
