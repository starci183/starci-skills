import { builder, mock } from "@starci/jest-preset"
import { GraphQLError } from "graphql"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { Test } from "@nestjs/testing"
import { DomainError } from "./domain.error"
import { ERRORS_OPTIONS } from "./errors.decorators"
import { ErrorsLogEvent } from "./errors.log-events"
import type { ErrorsOptions } from "./errors.options"
import { ErrorsService } from "./errors.service"

class ShopError extends DomainError<"SHOP_SOLD_OUT" | "SHOP_UNDECLARED"> {}
class OwnError extends DomainError<"ERRORS_OPERATION_INVALID"> {}

const options = builder<ErrorsOptions>({ kinds: [{ SHOP_SOLD_OUT: "conflict" }] })

describe("ErrorsService", () => {
    const build = async () => {
        const catalog = mock<MessageCatalog>()
        const logger = mock<Logger>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                ErrorsService,
                { provide: ERRORS_OPTIONS, useValue: options() },
                { provide: MESSAGE_CATALOG, useValue: catalog },
                { provide: LOGGER, useValue: logger },
            ],
        }).compile()
        return { errors: moduleRef.get(ErrorsService), catalog, logger }
    }

    describe("describe", () => {
        it("keeps the code, kind and params of a declared domain error", async () => {
            const { errors, logger } = await build()

            expect(errors.describe(new ShopError({ code: "SHOP_SOLD_OUT", params: { productId: "sku-1" } }))).toEqual({
                code: "SHOP_SOLD_OUT",
                kind: "conflict",
                status: 409,
                params: { productId: "sku-1" },
            })
            expect(logger.error).not.toHaveBeenCalled()
        })

        it("keeps the code of an error the errors capability itself declares", async () => {
            const { errors } = await build()

            expect(errors.describe(new OwnError({ code: "ERRORS_OPERATION_INVALID" }))).toMatchObject({
                code: "ERRORS_OPERATION_INVALID",
                kind: "invalid",
                status: 400,
            })
        })

        it("masks a domain error no capability declared and logs it", async () => {
            const { errors, logger } = await build()
            const undeclared = new ShopError({ code: "SHOP_UNDECLARED" })

            expect(errors.describe(undeclared)).toEqual({
                code: "ERRORS_INTERNAL",
                kind: "internal",
                status: 500,
                params: {},
            })
            expect(logger.error).toHaveBeenCalledWith(ErrorsLogEvent.Unhandled, undeclared)
        })

        it("masks any other failure and logs it", async () => {
            const { errors, logger } = await build()
            const failure = new Error("boom")

            expect(errors.describe(failure).code).toBe("ERRORS_INTERNAL")
            expect(logger.error).toHaveBeenCalledWith(ErrorsLogEvent.Unhandled, failure)
        })
    })

    describe("describeInvalidOperation", () => {
        it("describes a malformed operation as invalid", async () => {
            const { errors } = await build()

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
            const { errors, catalog } = await build()
            catalog.get.mockReturnValue("Het hang")

            expect(errors.text("SHOP_SOLD_OUT", { productId: "sku-1" }, "vi")).toBe("Het hang")
            expect(catalog.get).toHaveBeenCalledWith("errors.SHOP_SOLD_OUT", { productId: "sku-1" }, "vi")
        })

        it("returns the text of the internal error when the code has no catalog entry", async () => {
            const { errors, catalog } = await build()
            catalog.get.mockImplementation((key) => (key === "errors.ERRORS_INTERNAL" ? "Something broke" : key))

            expect(errors.text("SHOP_SOLD_OUT", {}, "en")).toBe("Something broke")
        })
    })

    describe("formatError", () => {
        it("answers the code, kind and params of the original error of a GraphQL failure", async () => {
            const { errors } = await build()
            const original = new ShopError({ code: "SHOP_SOLD_OUT", params: { productId: "sku-1" } })
            const graphql = new GraphQLError("wrapped", { originalError: original, path: ["placeOrder"] })

            expect(errors.formatError(graphql.toJSON(), graphql)).toEqual({
                message: "SHOP_SOLD_OUT",
                locations: undefined,
                path: ["placeOrder"],
                extensions: { code: "SHOP_SOLD_OUT", kind: "conflict", params: { productId: "sku-1" } },
            })
        })

        it("answers an invalid operation for a GraphQL failure without an original error", async () => {
            const { errors } = await build()
            const graphql = new GraphQLError("Syntax Error")

            expect(errors.formatError(graphql.toJSON(), graphql).extensions).toEqual({
                code: "ERRORS_OPERATION_INVALID",
                kind: "invalid",
                params: {},
            })
        })

        it("masks a failure that is not a GraphQL error", async () => {
            const { errors } = await build()
            const graphql = new GraphQLError("plain")

            expect(errors.formatError(graphql.toJSON(), new Error("boom")).extensions).toEqual({
                code: "ERRORS_INTERNAL",
                kind: "internal",
                params: {},
            })
        })
    })
})
