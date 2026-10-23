import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { GraphQLError } from "graphql"
import type { ErrorsService } from "./errors.service"
import { formatGraphqlError } from "./graphql-error.mapper"

const SUBJECT: unique symbol = Symbol("errors.graphql")
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: () => formatGraphqlError }],
    }).compile()
    return moduleRef.get<typeof formatGraphqlError>(SUBJECT)
}

const located = { message: "raw", path: ["item"], locations: [{ line: 1, column: 3 }] }

describe("formatGraphqlError", () => {
    it("describes the original failure of a resolver and keeps the path and locations it carries", async () => {
        const subject = await buildSubject()
        const errors = mock<ErrorsService>()
        const cause = new Error("not found")
        errors.describe.mockReturnValue({
            code: "ITEM_NOT_FOUND",
            kind: "not-found",
            status: 404,
            params: { id: "i-1" },
        })

        expect(subject(errors, located, new GraphQLError("wrapped", { originalError: cause }))).toEqual({
            message: "ITEM_NOT_FOUND",
            path: ["item"],
            locations: [{ line: 1, column: 3 }],
            extensions: { code: "ITEM_NOT_FOUND", kind: "not-found", params: { id: "i-1" } },
        })
        expect(errors.describe).toHaveBeenCalledWith(cause)
    })

    it("marks a malformed operation invalid and leaves out the path and locations it does not carry", async () => {
        const subject = await buildSubject()
        const errors = mock<ErrorsService>()
        errors.describeInvalidOperation.mockReturnValue({
            code: "GRAPHQL_OPERATION_INVALID",
            kind: "invalid",
            status: 400,
            params: {},
        })

        expect(subject(errors, { message: "raw" }, new GraphQLError("GRAPHQL_VALIDATION_FAILED"))).toEqual({
            message: "GRAPHQL_OPERATION_INVALID",
            extensions: { code: "GRAPHQL_OPERATION_INVALID", kind: "invalid", params: {} },
        })
        expect(errors.describe).not.toHaveBeenCalled()
    })

    it("describes a failure that is not a GraphQL error as it is", async () => {
        const subject = await buildSubject()
        const errors = mock<ErrorsService>()
        const cause = new Error("boom")
        errors.describe.mockReturnValue({ code: "ERRORS_INTERNAL", kind: "internal", status: 500, params: {} })

        expect(subject(errors, { message: "raw" }, cause).extensions).toEqual({
            code: "ERRORS_INTERNAL",
            kind: "internal",
            params: {},
        })
        expect(errors.describe).toHaveBeenCalledWith(cause)
    })
})
