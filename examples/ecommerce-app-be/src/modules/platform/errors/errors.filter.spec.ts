import type { ArgumentsHost } from "@nestjs/common"
import { mock } from "@starci/jest-preset/mock"
import type { RequestLocale } from "@modules/platform/i18n"
import type { ErrorDescription } from "./errors.contracts"
import { ErrorsFilter } from "./errors.filter"
import type { ErrorsService } from "./errors.service"

const description: ErrorDescription = { code: "SAMPLE_MISSING", kind: "not-found", status: 404, params: { id: "a" } }

describe("ErrorsFilter", () => {
    const errors = mock<ErrorsService>({
        describe: jest.fn().mockReturnValue(description),
        text: jest.fn().mockReturnValue("Not found"),
    })
    const requestLocale = mock<RequestLocale>({ of: jest.fn().mockReturnValue("en") })
    const filter = new ErrorsFilter(errors, requestLocale)

    it("answers a REST failure with the status of its kind and the code, kind, message and params", () => {
        const json = jest.fn()
        const status = jest.fn().mockReturnValue({ json })
        const host = mock<ArgumentsHost>({
            getType: jest.fn().mockReturnValue("http"),
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: () => ({ headers: { "accept-language": "en" } }),
                getResponse: () => ({ status }),
            }),
        })
        filter.catch(new TypeError("x"), host)
        expect(status).toHaveBeenCalledWith(404)
        expect(json).toHaveBeenCalledWith({ code: "SAMPLE_MISSING", kind: "not-found", message: "Not found", params: { id: "a" } })
        expect(errors.text).toHaveBeenCalledWith("SAMPLE_MISSING", { id: "a" }, "en")
    })

    it("hands a GraphQL failure back untouched for the GraphQL formatter", () => {
        const failure = new TypeError("x")
        const host = mock<ArgumentsHost>({ getType: jest.fn().mockReturnValue("graphql") })
        expect(filter.catch(failure, host)).toBe(failure)
    })
})
