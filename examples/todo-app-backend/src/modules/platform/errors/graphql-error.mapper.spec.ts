import { GraphQLError } from "graphql"
import { mock } from "@starci/jest-preset/mock"
import type { ErrorDescriber, ErrorDescription } from "./errors.contracts"
import { ErrorsError, ErrorsErrorCode } from "./errors/errors.error"
import { formatGraphqlError } from "./graphql-error.mapper"

const described: ErrorDescription = { code: "SAMPLE_MISSING", kind: "not-found", status: 404, params: { id: "a" } }
const invalid: ErrorDescription = { code: "ERRORS_OPERATION_INVALID", kind: "invalid", status: 400, params: {} }

const errorsService = (): ErrorDescriber =>
    mock<ErrorDescriber>({
        describe: jest.fn().mockReturnValue(described),
        describeInvalidOperation: jest.fn().mockReturnValue(invalid),
    })

describe("formatGraphqlError", () => {
    it("answers the code, kind and params of a failure thrown by a resolver", () => {
        const original = new ErrorsError({ code: ErrorsErrorCode.Internal })
        const formatted = formatGraphqlError(errorsService(), { message: "x", path: ["cart"] }, new GraphQLError("x", { originalError: original }))
        expect(formatted).toMatchObject({
            message: "SAMPLE_MISSING",
            path: ["cart"],
            extensions: { code: "SAMPLE_MISSING", kind: "not-found", params: { id: "a" } },
        })
    })

    it("answers an invalid operation when the GraphQL error has no original error", () => {
        const formatted = formatGraphqlError(errorsService(), { message: ErrorsErrorCode.OperationInvalid }, new GraphQLError(ErrorsErrorCode.OperationInvalid))
        expect(formatted.extensions).toMatchObject({ code: "ERRORS_OPERATION_INVALID", kind: "invalid" })
    })

    it("describes any other thrown value through the service", () => {
        const service = errorsService()
        formatGraphqlError(service, { message: "x" }, new TypeError("boom"))
        expect(service.describe).toHaveBeenCalledWith(expect.any(TypeError))
    })
})
