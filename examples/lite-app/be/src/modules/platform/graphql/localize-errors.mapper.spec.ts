import { Test } from "@nestjs/testing"
import type { GraphQLRequestContext, GraphQLRequestContextWillSendResponse, GraphQLResponse } from "@apollo/server"
import { mock } from "@starci/jest-preset"
import type { Request } from "express"
import type { GraphQLFormattedError } from "graphql"
import type { ErrorsService } from "@modules/platform/errors"
import type { RequestLocale } from "@modules/platform/i18n"
import type { GraphqlContext } from "./graphql.contracts"
import { localizeError, localizeErrorsPlugin } from "./localize-errors.mapper"

const singleResponse = (errors?: ReadonlyArray<GraphQLFormattedError>): GraphQLResponse =>
    mock<GraphQLResponse>({ body: { kind: "single", singleResult: { errors } } })

const requestContext = (
    response: GraphQLResponse,
    headers: Request["headers"],
): GraphQLRequestContextWillSendResponse<GraphqlContext> =>
    mock<GraphQLRequestContextWillSendResponse<GraphqlContext>>({
        contextValue: { req: mock<Request>({ headers }), res: mock<GraphqlContext["res"]>() },
        response,
    })

const sendResponse = async (
    errors: ErrorsService,
    requestLocale: RequestLocale,
    context: GraphQLRequestContextWillSendResponse<GraphqlContext>,
): Promise<void> => {
    const subject = await buildSubject()
    const listener = await subject
        .localizeErrorsPlugin(errors, requestLocale)
        .requestDidStart?.(mock<GraphQLRequestContext<GraphqlContext>>())
    await listener?.willSendResponse?.(context)
}

const SUBJECT: unique symbol = Symbol("graphql.localize")
const buildSubject = async () => {
    const functions = { localizeError, localizeErrorsPlugin }
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: () => functions }],
    }).compile()
    return moduleRef.get<typeof functions>(SUBJECT)
}

describe("localizeError", () => {
    it("returns an error without a string code unchanged", async () => {
        const subject = await buildSubject()
        const errors = mock<ErrorsService>()
        const error: GraphQLFormattedError = { message: "syntax error", extensions: { kind: "invalid" } }

        expect(subject.localizeError(errors, "en", error)).toBe(error)
        expect(errors.text).not.toHaveBeenCalled()
    })

    it("replaces a coded error's message with the catalog text and keeps only string and number params", async () => {
        const subject = await buildSubject()
        const errors = mock<ErrorsService>()
        errors.text.mockReturnValue("The item was not found")
        const error: GraphQLFormattedError = {
            message: "ITEM_NOT_FOUND",
            extensions: { code: "ITEM_NOT_FOUND", params: { id: "i-1", retries: 2, transient: false } },
        }

        expect(subject.localizeError(errors, "en", error)).toEqual({ ...error, message: "The item was not found" })
        expect(errors.text).toHaveBeenCalledWith("ITEM_NOT_FOUND", { id: "i-1", retries: 2 }, "en")
    })

    it.each([undefined, null, ["i-1"], "i-1"])(
        "interpolates no params when extensions.params is %p",
        async (params) => {
            const subject = await buildSubject()
            const errors = mock<ErrorsService>()
            errors.text.mockReturnValue("The item was not found")
            const error: GraphQLFormattedError = {
                message: "ITEM_NOT_FOUND",
                extensions: { code: "ITEM_NOT_FOUND", params },
            }

            expect(subject.localizeError(errors, "en", error).message).toBe("The item was not found")
            expect(errors.text).toHaveBeenCalledWith("ITEM_NOT_FOUND", {}, "en")
        },
    )
})

describe("localizeErrorsPlugin", () => {
    it("localizes a coded error in the language the Accept-Language header declares", async () => {
        const errors = mock<ErrorsService>()
        const requestLocale = mock<RequestLocale>()
        requestLocale.of.mockReturnValue("vi")
        errors.text.mockReturnValue("localized: not found")
        const coded: GraphQLFormattedError = { message: "ITEM_NOT_FOUND", extensions: { code: "ITEM_NOT_FOUND" } }
        const response = singleResponse([coded])

        const context = requestContext(response, { "accept-language": "vi" })

        await sendResponse(errors, requestLocale, context)

        expect(requestLocale.of).toHaveBeenCalledWith("vi")
        expect(response.body.kind === "single" && response.body.singleResult.errors).toEqual([
            { ...coded, message: "localized: not found" },
        ])
    })

    it.each([undefined, ""])(
        "passes an absent or empty Accept-Language header to the locale owner (%p)",
        async (declared) => {
            const errors = mock<ErrorsService>()
            const requestLocale = mock<RequestLocale>()
            requestLocale.of.mockReturnValue("vi")
            errors.text.mockReturnValue("localized: not found")
            const coded: GraphQLFormattedError = { message: "ITEM_NOT_FOUND", extensions: { code: "ITEM_NOT_FOUND" } }

            await sendResponse(
                errors,
                requestLocale,
                requestContext(singleResponse([coded]), { "accept-language": declared }),
            )

            expect(requestLocale.of).toHaveBeenCalledWith(declared)
            expect(errors.text).toHaveBeenCalledWith("ITEM_NOT_FOUND", {}, "vi")
        },
    )

    it("leaves a response without errors alone", async () => {
        const errors = mock<ErrorsService>()
        const requestLocale = mock<RequestLocale>()

        await sendResponse(errors, requestLocale, requestContext(singleResponse(), { "accept-language": "en" }))

        expect(requestLocale.of).not.toHaveBeenCalled()
        expect(errors.text).not.toHaveBeenCalled()
    })
})
