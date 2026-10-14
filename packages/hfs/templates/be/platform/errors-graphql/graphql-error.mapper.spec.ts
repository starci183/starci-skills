import { mock } from "@starci/jest-preset"
import { GraphQLError } from "graphql"
import type { ErrorsService } from "./errors.service"
import { formatGraphqlError } from "./graphql-error.mapper"

const formatted = { message: "raw", path: ["item"], locations: [{ line: 1, column: 3 }] }

describe("formatGraphqlError", () => {
    it("keeps the message of a malformed operation and marks it invalid without describing it", () => {
        const errors = mock<ErrorsService>()

        expect(formatGraphqlError(errors, formatted, new GraphQLError("GRAPHQL_VALIDATION_FAILED"))).toEqual({
            message: "raw",
            path: ["item"],
            locations: [{ line: 1, column: 3 }],
            extensions: { kind: "invalid" },
        })
        expect(errors.describe).not.toHaveBeenCalled()
    })

    it("describes the original failure of a resolver and travels its code, kind and params", () => {
        const errors = mock<ErrorsService>()
        const cause = new Error("not found")
        errors.describe.mockReturnValue({
            code: "ITEM_NOT_FOUND",
            kind: "not-found",
            status: 404,
            params: { id: "i-1" },
        })

        expect(formatGraphqlError(errors, formatted, new GraphQLError("wrapped", { originalError: cause }))).toEqual({
            message: "ITEM_NOT_FOUND",
            path: ["item"],
            locations: [{ line: 1, column: 3 }],
            extensions: { code: "ITEM_NOT_FOUND", kind: "not-found", params: { id: "i-1" } },
        })
        expect(errors.describe).toHaveBeenCalledWith(cause)
    })

    it("describes a failure that is not a GraphQL error as it is", () => {
        const errors = mock<ErrorsService>()
        const cause = new Error("boom")
        errors.describe.mockReturnValue({ code: "ERRORS_INTERNAL", kind: "internal", status: 500, params: {} })

        expect(formatGraphqlError(errors, formatted, cause).extensions).toEqual({
            code: "ERRORS_INTERNAL",
            kind: "internal",
            params: {},
        })
        expect(errors.describe).toHaveBeenCalledWith(cause)
    })
})
