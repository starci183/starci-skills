import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { GraphQLError } from "graphql"
import type { ErrorsService } from "./errors.service"
import { formatGraphqlError } from "./graphql-error.mapper"

const formatted = { message: "raw", path: ["item"], locations: [{ line: 1, column: 3 }] }

const SUBJECT: unique symbol = Symbol("errors.graphql")
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: () => formatGraphqlError }],
    }).compile()
    return moduleRef.get<typeof formatGraphqlError>(SUBJECT)
}

describe("formatGraphqlError", () => {
    it("keeps the message of a malformed operation and marks it invalid without describing it", async () => {
        const subject = await buildSubject()
        const errors = mock<ErrorsService>()

        expect(subject(errors, formatted, new GraphQLError("GRAPHQL_VALIDATION_FAILED"))).toEqual({
            message: "raw",
            path: ["item"],
            locations: [{ line: 1, column: 3 }],
            extensions: { kind: "invalid" },
        })
        expect(errors.describe).not.toHaveBeenCalled()
    })

    it("describes the original failure of a resolver and travels its code, kind and params", async () => {
        const subject = await buildSubject()
        const errors = mock<ErrorsService>()
        const cause = new Error("not found")
        errors.describe.mockReturnValue({
            code: "ITEM_NOT_FOUND",
            kind: "not-found",
            status: 404,
            params: { id: "i-1" },
        })

        expect(subject(errors, formatted, new GraphQLError("wrapped", { originalError: cause }))).toEqual({
            message: "ITEM_NOT_FOUND",
            path: ["item"],
            locations: [{ line: 1, column: 3 }],
            extensions: { code: "ITEM_NOT_FOUND", kind: "not-found", params: { id: "i-1" } },
        })
        expect(errors.describe).toHaveBeenCalledWith(cause)
    })

    it("describes a failure that is not a GraphQL error as it is", async () => {
        const subject = await buildSubject()
        const errors = mock<ErrorsService>()
        const cause = new Error("boom")
        errors.describe.mockReturnValue({ code: "ERRORS_INTERNAL", kind: "internal", status: 500, params: {} })

        expect(subject(errors, formatted, cause).extensions).toEqual({
            code: "ERRORS_INTERNAL",
            kind: "internal",
            params: {},
        })
        expect(errors.describe).toHaveBeenCalledWith(cause)
    })

    it("leaves out the locations and path a formatted error does not carry", async () => {
        const subject = await buildSubject()
        const errors = mock<ErrorsService>()
        errors.describe.mockReturnValue({ code: "ERRORS_INTERNAL", kind: "internal", status: 500, params: {} })

        expect(subject(errors, { message: "raw" }, new GraphQLError("GRAPHQL_PARSE_FAILED"))).toEqual({
            message: "raw",
            extensions: { kind: "invalid" },
        })
        expect(subject(errors, { message: "raw" }, new Error("boom"))).toEqual({
            message: "ERRORS_INTERNAL",
            extensions: { code: "ERRORS_INTERNAL", kind: "internal", params: {} },
        })
    })
})
