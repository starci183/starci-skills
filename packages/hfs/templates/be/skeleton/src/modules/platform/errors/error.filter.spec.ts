import { ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common"
import { HttpArgumentsHost } from "@nestjs/common/interfaces"
import { mock } from "@starci/jest-preset/mock"
import type { Response } from "express"
import { Logger, LogId } from "@modules/platform/logging"
import { ErrorFilter } from "./error.filter"

const arrange = () => {
    const response = mock<Response>()
    response.status.mockReturnValue(response)
    const http = mock<HttpArgumentsHost>()
    http.getResponse.mockReturnValue(response)
    const host = mock<ArgumentsHost>()
    host.switchToHttp.mockReturnValue(http)
    const logger = mock<Logger>()
    return { response, host, logger, filter: new ErrorFilter(logger) }
}

describe("ErrorFilter", () => {
    it("answers an unknown failure with a 500 that names no detail, and logs it once", () => {
        const { response, host, logger, filter } = arrange()
        filter.catch(new TypeError("secret detail"), host)
        expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
        expect(response.json).toHaveBeenCalledWith({ code: "internal_error" })
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith(LogId.RequestFailed, {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            failure: { name: "TypeError" },
        })
    })

    it("keeps the status of a framework exception and answers with its status code only", () => {
        const { response, host, filter } = arrange()
        filter.catch(new HttpException("Not Found", HttpStatus.NOT_FOUND), host)
        expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND)
        expect(response.json).toHaveBeenCalledWith({ code: "http_404" })
    })
})
