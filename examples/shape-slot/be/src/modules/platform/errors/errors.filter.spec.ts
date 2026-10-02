import type { ArgumentsHost } from "@nestjs/common"
import { mock } from "@starci/jest-preset"
import type { Request, Response } from "express"
import type { RequestLocale } from "@modules/platform/i18n"
import { ErrorsFilter } from "./errors.filter"
import type { ErrorsService } from "./errors.service"

const build = () => {
    const errors = mock<ErrorsService>()
    const requestLocale = mock<RequestLocale>()
    return { filter: new ErrorsFilter(errors, requestLocale), errors, requestLocale }
}

describe("ErrorsFilter", () => {
    it("writes a localized description and its status to an HTTP response", () => {
        const { filter, errors, requestLocale } = build()
        const failure = new Error("note missing")
        const request = mock<Request>({ headers: { "accept-language": "en-US,en;q=0.9" } })
        const response = mock<Response>()
        response.status.mockReturnValue(response)
        const http = mock<ReturnType<ArgumentsHost["switchToHttp"]>>()
        http.getRequest.mockReturnValue(request)
        http.getResponse.mockReturnValue(response)
        const host = mock<ArgumentsHost>()
        host.switchToHttp.mockReturnValue(http)
        errors.describe.mockReturnValue({
            code: "NOTE_NOT_FOUND",
            kind: "not-found",
            status: 404,
            params: { noteId: "note-1" },
        })
        requestLocale.of.mockReturnValue("en")
        errors.text.mockReturnValue("The note was not found")

        expect(filter.catch(failure, host)).toBeUndefined()

        expect(errors.describe).toHaveBeenCalledWith(failure)
        expect(requestLocale.of).toHaveBeenCalledWith("en-US,en;q=0.9")
        expect(errors.text).toHaveBeenCalledWith("NOTE_NOT_FOUND", { noteId: "note-1" }, "en")
        expect(response.status).toHaveBeenCalledWith(404)
        expect(response.json).toHaveBeenCalledWith({
            code: "NOTE_NOT_FOUND",
            kind: "not-found",
            message: "The note was not found",
            params: { noteId: "note-1" },
        })
    })
})
