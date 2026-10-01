import { mock } from "@starci/jest-preset"
import { GraphQLError } from "graphql"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { PROBES_ERROR_KINDS, ProbesError, ProbesErrorCode } from "@modules/platform/probes"
import { Test } from "@nestjs/testing"
import { ERRORS_OPTIONS } from "./errors.decorators"
import { ErrorsError, ErrorsErrorCode } from "./errors/errors.error"
import { ErrorsLogEvent } from "./errors.log-events"
import type { ErrorKindTable } from "./errors.contracts"
import { ErrorsService } from "./errors.service"

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
            const { errors, logger } = await build([PROBES_ERROR_KINDS])
            const declared = new ProbesError({
                code: ProbesErrorCode.DependencyUnavailable,
                params: { database: "unreachable" },
            })

            expect(errors.describe(declared)).toEqual({
                code: "PROBES_DEPENDENCY_UNAVAILABLE",
                kind: "unavailable",
                status: 503,
                params: { database: "unreachable" },
            })
            expect(logger.error).not.toHaveBeenCalled()
        })

        it("keeps the code of an error the errors capability itself declares", async () => {
            const { errors } = await build([])

            expect(errors.describe(new ErrorsError({ code: ErrorsErrorCode.OperationInvalid }))).toMatchObject({
                code: "ERRORS_OPERATION_INVALID",
                kind: "invalid",
                status: 400,
            })
        })

        it("masks a domain error no composed capability declared and logs it", async () => {
            const { errors, logger } = await build([])
            const undeclared = new ProbesError({ code: ProbesErrorCode.DependencyUnavailable })

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

    describe("describeInvalidOperation", () => {
        it("describes a malformed operation as invalid", async () => {
            const { errors } = await build([])

            expect(errors.describeInvalidOperation()).toEqual({
                code: "ERRORS_OPERATION_INVALID",
                kind: "invalid",
                status: 400,
                params: {},
            })
        })
    })

    describe("text", () => {
        it("returns the catalog text of the code in the locale", async () => {
            const { errors, catalog } = await build([])
            catalog.get.mockReturnValue("A dependency is down")

            expect(errors.text("PROBES_DEPENDENCY_UNAVAILABLE", { database: "unreachable" }, "en")).toBe(
                "A dependency is down",
            )
            expect(catalog.get).toHaveBeenCalledWith(
                "errors.PROBES_DEPENDENCY_UNAVAILABLE",
                { database: "unreachable" },
                "en",
            )
        })

        it("returns the text of the internal error when the code has no catalog entry", async () => {
            const { errors, catalog } = await build([])
            catalog.get.mockImplementation((key) => (key === "errors.ERRORS_INTERNAL" ? "Something broke" : key))

            expect(errors.text("PROBES_DEPENDENCY_UNAVAILABLE", {}, "en")).toBe("Something broke")
        })
    })

    describe("formatError", () => {
        it("answers the code, kind and params of the original error of a GraphQL failure", async () => {
            const { errors } = await build([PROBES_ERROR_KINDS])
            const original = new ProbesError({
                code: ProbesErrorCode.DependencyUnavailable,
                params: { database: "unreachable" },
            })
            const graphql = new GraphQLError(original.code, { originalError: original, path: ["health"] })

            expect(errors.formatError(graphql.toJSON(), graphql)).toEqual({
                message: "PROBES_DEPENDENCY_UNAVAILABLE",
                locations: undefined,
                path: ["health"],
                extensions: {
                    code: "PROBES_DEPENDENCY_UNAVAILABLE",
                    kind: "unavailable",
                    params: { database: "unreachable" },
                },
            })
        })

        it("answers an invalid operation for a GraphQL failure without an original error", async () => {
            const { errors } = await build([])
            const graphql = new GraphQLError(ErrorsErrorCode.OperationInvalid)

            expect(errors.formatError(graphql.toJSON(), graphql).extensions).toEqual({
                code: "ERRORS_OPERATION_INVALID",
                kind: "invalid",
                params: {},
            })
        })

        it("masks a failure that is not a GraphQL error", async () => {
            const { errors } = await build([])
            const graphql = new GraphQLError(ErrorsErrorCode.Internal)

            expect(errors.formatError(graphql.toJSON(), new Error("boom")).extensions).toEqual({
                code: "ERRORS_INTERNAL",
                kind: "internal",
                params: {},
            })
        })
    })
})
