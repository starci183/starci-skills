import type { GraphQLRequestContext, GraphQLRequestContextWillSendResponse, GraphQLResponse } from "@apollo/server"
import { mock } from "@starci/jest-preset"
import type { GraphQLFormattedError } from "graphql"
import type { ErrorsService } from "@modules/platform/errors"
import type { RequestLocale } from "@modules/platform/i18n"
import type { GraphqlContext } from "./graphql.contracts"
import { localizeError, localizeErrorsPlugin } from "./localize-errors.mapper"

type IncrementalBody = Extract<GraphQLResponse["body"], { kind: "incremental" }>

const singleResponse = (errors?: ReadonlyArray<GraphQLFormattedError>): GraphQLResponse =>
    mock<GraphQLResponse>({ body: { kind: "single", singleResult: { errors } } })

const incrementalResponse = (): GraphQLResponse =>
    mock<GraphQLResponse>({ body: mock<IncrementalBody>({ kind: "incremental" }) })

const requestContext = (response: GraphQLResponse): GraphQLRequestContextWillSendResponse<GraphqlContext> =>
    mock<GraphQLRequestContextWillSendResponse<GraphqlContext>>({
        contextValue: {
            req: {
                headers: { "accept-language": "en-US,en;q=0.9" },
                method: "POST",
                ip: "203.0.113.9",
            },
            res: undefined,
        },
        response,
    })

const sendResponse = async (
    errors: ErrorsService,
    requestLocale: RequestLocale,
    context: GraphQLRequestContextWillSendResponse<GraphqlContext>,
): Promise<void> => {
    const listener = await localizeErrorsPlugin(errors, requestLocale).requestDidStart?.(
        mock<GraphQLRequestContext<GraphqlContext>>(),
    )
    if (listener === undefined || listener === null || listener.willSendResponse === undefined) {
        throw new Error("the plugin did not register willSendResponse")
    }
    await listener.willSendResponse(context)
}

describe("localizeError", () => {
    it.each<{ error: GraphQLFormattedError }>([
        { error: { message: "syntax error" } },
        { error: { message: "numeric code", extensions: { code: 7 } } },
    ])("returns an error without a string code unchanged", ({ error }) => {
        const errors = mock<ErrorsService>()

        expect(localizeError(errors, "en", error)).toBe(error)
        expect(errors.text).not.toHaveBeenCalled()
    })

    it("replaces a coded error's message with the catalog text and keeps its other fields", () => {
        const errors = mock<ErrorsService>()
        errors.text.mockReturnValue("The order was not found")
        const error: GraphQLFormattedError = {
            message: "ORDER_NOT_FOUND",
            path: ["order"],
            extensions: {
                code: "ORDER_NOT_FOUND",
                params: { orderId: "o-1", retries: 2, transient: false, detail: { id: "o-1" } },
            },
        }

        expect(localizeError(errors, "en", error)).toEqual({
            ...error,
            message: "The order was not found",
        })
        expect(errors.text).toHaveBeenCalledWith("ORDER_NOT_FOUND", { orderId: "o-1", retries: 2 }, "en")
    })

    it("uses empty interpolation params when the extension params are not a record", () => {
        const errors = mock<ErrorsService>()
        errors.text.mockReturnValue("The order was not found")

        expect(
            localizeError(errors, "vi", {
                message: "ORDER_NOT_FOUND",
                extensions: { code: "ORDER_NOT_FOUND", params: "o-1" },
            }).message,
        ).toBe("The order was not found")
        expect(errors.text).toHaveBeenCalledWith("ORDER_NOT_FOUND", {}, "vi")
    })
})

describe("localizeErrorsPlugin", () => {
    it("leaves an incremental response unchanged", async () => {
        const errors = mock<ErrorsService>()
        const requestLocale = mock<RequestLocale>()
        const response = incrementalResponse()

        await sendResponse(errors, requestLocale, requestContext(response))

        expect(requestLocale.of).not.toHaveBeenCalled()
        expect(errors.text).not.toHaveBeenCalled()
    })

    it("leaves a single response without errors unchanged", async () => {
        const errors = mock<ErrorsService>()
        const requestLocale = mock<RequestLocale>()
        const response = singleResponse()

        await sendResponse(errors, requestLocale, requestContext(response))

        expect(requestLocale.of).not.toHaveBeenCalled()
        expect(errors.text).not.toHaveBeenCalled()
    })

    it("localizes every coded error of a single response in the request locale", async () => {
        const errors = mock<ErrorsService>()
        const requestLocale = mock<RequestLocale>()
        requestLocale.of.mockReturnValue("en")
        errors.text.mockReturnValue("The order was not found")
        const unchanged: GraphQLFormattedError = { message: "invalid operation" }
        const coded: GraphQLFormattedError = {
            message: "ORDER_NOT_FOUND",
            extensions: { code: "ORDER_NOT_FOUND", params: { orderId: "o-1" } },
        }
        const response = singleResponse([unchanged, coded])

        await sendResponse(errors, requestLocale, requestContext(response))

        expect(requestLocale.of).toHaveBeenCalledWith("en-US,en;q=0.9")
        expect(errors.text).toHaveBeenCalledWith("ORDER_NOT_FOUND", { orderId: "o-1" }, "en")
        if (response.body.kind !== "single") throw new Error("the response stopped being a single result")
        expect(response.body.singleResult.errors).toEqual([unchanged, { ...coded, message: "The order was not found" }])
    })
})
