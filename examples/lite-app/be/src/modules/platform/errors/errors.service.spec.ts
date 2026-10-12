import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { Logger } from "@modules/platform/logging"
import { LOGGER } from "@modules/platform/logging"
import type { MessageCatalog } from "@modules/platform/i18n"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import { DomainError } from "./domain.error"
import { ERRORS_OPTIONS } from "./errors.decorators"
import { ErrorsError, ErrorsErrorCode } from "./errors/errors.error"
import { ErrorsLogEvent } from "./errors.log-events"
import type { ErrorKindTable } from "./errors.contracts"
import { ErrorsService } from "./errors.service"

type CalendarsErrorCode = "CALENDARS_NOT_FOUND"

class CalendarsError extends DomainError<CalendarsErrorCode> {}

const CALENDARS_ERROR_KINDS: ErrorKindTable = { CALENDARS_NOT_FOUND: "not-found" }

const build = async (kinds: ReadonlyArray<ErrorKindTable>) => {
    const catalog = mock<MessageCatalog>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ErrorsService,
            { provide: ERRORS_OPTIONS, useValue: { kinds } },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { errors: moduleRef.get(ErrorsService), catalog, logger }
}

describe("ErrorsService", () => {
    describe("describe", () => {
        it("keeps the code, kind and params of a declared domain error", async () => {
            const { errors, logger } = await build([CALENDARS_ERROR_KINDS])
            const declared = new CalendarsError({ code: "CALENDARS_NOT_FOUND", params: { id: "calendar-1" } })

            expect(errors.describe(declared)).toEqual({
                code: "CALENDARS_NOT_FOUND",
                kind: "not-found",
                status: 404,
                params: { id: "calendar-1" },
            })
            expect(logger.error).not.toHaveBeenCalled()
        })

        it("keeps the code of an error the errors capability itself declares", async () => {
            const { errors } = await build([])

            expect(errors.describe(new ErrorsError({ code: ErrorsErrorCode.Internal }))).toEqual({
                code: "ERRORS_INTERNAL",
                kind: "internal",
                status: 500,
                params: {},
            })
        })

        it("masks a domain error no composed capability declared and logs it", async () => {
            const { errors, logger } = await build([])
            const undeclared = new CalendarsError({ code: "CALENDARS_NOT_FOUND" })

            expect(errors.describe(undeclared)).toEqual({
                code: "ERRORS_INTERNAL",
                kind: "internal",
                status: 500,
                params: {},
            })
            expect(logger.error).toHaveBeenCalledWith(ErrorsLogEvent.Unhandled, undeclared)
        })

        it("masks any other failure and logs it", async () => {
            const { errors, logger } = await build([])
            const failure = new Error("boom")

            expect(errors.describe(failure).code).toBe("ERRORS_INTERNAL")
            expect(logger.error).toHaveBeenCalledWith(ErrorsLogEvent.Unhandled, failure)
        })
    })

    describe("text", () => {
        it("returns the catalog text of the code in the locale", async () => {
            const { errors, catalog } = await build([])
            catalog.get.mockReturnValue("Calendar calendar-1 was not found")

            expect(errors.text("CALENDARS_NOT_FOUND", { id: "calendar-1" }, "en")).toBe(
                "Calendar calendar-1 was not found",
            )
            expect(catalog.get).toHaveBeenCalledWith("errors.CALENDARS_NOT_FOUND", { id: "calendar-1" }, "en")
        })

        it("returns the text of the internal error when the code has no catalog entry", async () => {
            const { errors, catalog } = await build([])
            catalog.get.mockImplementation((key) => (key === "errors.ERRORS_INTERNAL" ? "Something broke" : key))

            expect(errors.text("CALENDARS_NOT_FOUND", {}, "vi")).toBe("Something broke")
            expect(catalog.get).toHaveBeenLastCalledWith("errors.ERRORS_INTERNAL", {}, "vi")
        })
    })
})
