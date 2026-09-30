import { mock } from "@starci/jest-preset/mock"
import type { Logger } from "@modules/platform/logging"
import type { MessageCatalog } from "@modules/platform/i18n"
import { DomainError } from "./domain.error"
import { ErrorsErrorCode } from "./errors.error"
import { ErrorsLogEvent } from "./errors.log-events"
import { ErrorsService } from "./errors.service"

enum SampleErrorCode {
    Missing = "SAMPLE_MISSING",
    Unlisted = "SAMPLE_UNLISTED",
}

class SampleError extends DomainError<SampleErrorCode> {}

const build = (logger: Logger = mock<Logger>(), catalog: MessageCatalog = mock<MessageCatalog>()): ErrorsService =>
    new ErrorsService({ kinds: [{ [SampleErrorCode.Missing]: "not-found" }] }, catalog, logger)

describe("ErrorsService", () => {
    it("keeps the code, params and kind of a declared capability error", () => {
        const description = build().describe(new SampleError({ code: SampleErrorCode.Missing, params: { id: "a" } }))
        expect(description).toEqual({ code: "SAMPLE_MISSING", kind: "not-found", status: 404, params: { id: "a" } })
    })

    it("masks an undeclared failure as internal and logs the cause", () => {
        const logger = mock<Logger>()
        const cause = new TypeError("secret detail")
        const description = build(logger).describe(cause)
        expect(description).toEqual({ code: ErrorsErrorCode.Internal, kind: "internal", status: 500, params: {} })
        expect(logger.error).toHaveBeenCalledWith(ErrorsLogEvent.Unhandled, cause)
    })

    it("masks a capability error whose code no composed table declares", () => {
        const description = build().describe(new SampleError({ code: SampleErrorCode.Unlisted }))
        expect(description.code).toBe(ErrorsErrorCode.Internal)
    })

    it("describes a malformed operation as invalid", () => {
        expect(build().describeInvalidOperation()).toMatchObject({ code: ErrorsErrorCode.OperationInvalid, status: 400 })
    })

    it("resolves the display text through the catalog under the errors key", () => {
        const catalog = mock<MessageCatalog>({ get: jest.fn().mockReturnValue("text") })
        expect(build(mock<Logger>(), catalog).text("SAMPLE_MISSING", { id: "a" }, "en")).toBe("text")
        expect(catalog.get).toHaveBeenCalledWith("errors.SAMPLE_MISSING", { id: "a" }, "en")
    })

    it("answers the text of the internal error for a code the catalog does not know", () => {
        const catalog = mock<MessageCatalog>({
            get: jest.fn().mockImplementation((key: string) => (key === "errors.ERRORS_INTERNAL" ? "Oops" : key)),
        })
        expect(build(mock<Logger>(), catalog).text("SAMPLE_UNKNOWN", {}, "en")).toBe("Oops")
    })
})
