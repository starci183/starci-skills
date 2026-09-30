import { GraphQLError } from "graphql"
import { mock } from "@starci/jest-preset/mock"
import type { ErrorDescription } from "./errors.contracts"
import { ErrorsError, ErrorsErrorCode } from "./errors.error"
import type { ErrorsService } from "./errors.service"
import { formatGraphqlError } from "./graphql-error.mapper"

const described: ErrorDescription = { code: ErrorsErrorCode.Internal, kind: "internal", status: 500, params: { id: "a" } }
const invalid: ErrorDescription = { code: ErrorsErrorCode.OperationInvalid, kind: "invalid", status: 400, params: {} }

const errorsService = (): ErrorsService =>
    mock<ErrorsService>({
        describe: jest.fn().mockReturnValue(described),
        describeInvalidOperation: jest.fn().mockReturnValue(invalid),
    })

describe("formatGraphqlError", () => {
    it("answers the code, kind and params of a failure thrown by a resolver", () => {
        const original = new ErrorsError({ code: ErrorsErrorCode.Internal })
        const formatted = formatGraphqlError(errorsService(), { message: "x", path: ["cart"] }, new GraphQLError("x", { originalError: original }))
        expect(formatted).toMatchObject({
            message: ErrorsErrorCode.Internal,
            path: ["cart"],
            extensions: { code: ErrorsErrorCode.Internal, kind: "internal", params: { id: "a" } },
        })
    })

    it("answers an invalid operation when the GraphQL error has no original error", () => {
        const formatted = formatGraphqlError(errorsService(), { message: "syntax" }, new GraphQLError("syntax"))
        expect(formatted.extensions).toMatchObject({ code: ErrorsErrorCode.OperationInvalid, kind: "invalid" })
    })

    it("describes any other thrown value through the service", () => {
        const service = errorsService()
        formatGraphqlError(service, { message: "x" }, new TypeError("boom"))
        expect(service.describe).toHaveBeenCalledWith(expect.any(TypeError))
    })
})
