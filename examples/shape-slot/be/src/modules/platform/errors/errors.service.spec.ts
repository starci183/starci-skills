import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DomainError } from "./domain.error"
import { ErrorsErrorCode } from "./errors/errors.error"
import { ErrorsLogEvent } from "./errors.log-events"
import { ErrorsService } from "./errors.service"
import { ERRORS_OPTIONS } from "./errors.decorators"

enum DemoCode {
    Missing = "DEMO_MISSING",
    Undeclared = "DEMO_UNDECLARED",
}

class DemoError extends DomainError<DemoCode> {}

const build = async () => {
    const logger = mock<Logger>()
    const catalog = mock<MessageCatalog>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ErrorsService,
            { provide: ERRORS_OPTIONS, useValue: { kinds: [{ [DemoCode.Missing]: "not-found" }] } },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(ErrorsService), logger, catalog }
}

describe("ErrorsService", () => {
    describe("describe", () => {
        it("keeps the code, kind, status and params of a declared capability error", async () => {
            const { service, logger } = await build()

            const description = service.describe(new DemoError({ code: DemoCode.Missing, params: { id: "t-1" } }))

            expect(description).toEqual({
                code: DemoCode.Missing,
                kind: "not-found",
                status: 404,
                params: { id: "t-1" },
            })
            expect(logger.error).not.toHaveBeenCalled()
        })

        it("masks a capability error no composed capability declared, and logs it", async () => {
            const { service, logger } = await build()
            const error = new DemoError({ code: DemoCode.Undeclared })

            expect(service.describe(error)).toEqual({
                code: ErrorsErrorCode.Internal,
                kind: "internal",
                status: 500,
                params: {},
            })
            expect(logger.error).toHaveBeenCalledWith(ErrorsLogEvent.Unhandled, error)
        })

        it("masks any other failure as internal, and logs it", async () => {
            const { service, logger } = await build()
            const error = new Error("boom")

            expect(service.describe(error)).toEqual({
                code: ErrorsErrorCode.Internal,
                kind: "internal",
                status: 500,
                params: {},
            })
            expect(logger.error).toHaveBeenCalledWith(ErrorsLogEvent.Unhandled, error)
        })
    })

    describe("text", () => {
        it("answers the catalog text of the code in the locale", async () => {
            const { service, catalog } = await build()
            catalog.get.mockReturnValue("Not found")

            expect(service.text(DemoCode.Missing, { id: "t-1" }, "en")).toBe("Not found")
            expect(catalog.get).toHaveBeenCalledWith(`errors.${DemoCode.Missing}`, { id: "t-1" }, "en")
        })

        it("answers the text of the internal error for a code without a catalog entry", async () => {
            const { service, catalog } = await build()
            catalog.get.mockImplementation((key) => (key === `errors.${ErrorsErrorCode.Internal}` ? "Internal" : key))

            expect(service.text(DemoCode.Undeclared, {}, "en")).toBe("Internal")
            expect(catalog.get).toHaveBeenLastCalledWith(`errors.${ErrorsErrorCode.Internal}`, {}, "en")
        })
    })
})
