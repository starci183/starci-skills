import { mock } from "@starci/jest-preset/mock"
import type { ErrorsService } from "@modules/platform/errors"
import { localizeError } from "./localize-errors.mapper"

describe("localizeError", () => {
    it("replaces the message of an error carrying a code with its catalog text, keeping only scalar params", () => {
        const errors = mock<ErrorsService>({ text: jest.fn().mockReturnValue("Hello") })
        const localized = localizeError(errors, "en", {
            message: "X_CODE",
            extensions: { code: "X_CODE", params: { a: 1, b: { nested: true } } },
        })
        expect(errors.text).toHaveBeenCalledWith("X_CODE", { a: 1 }, "en")
        expect(localized.message).toBe("Hello")
    })

    it("leaves an error without a code untouched", () => {
        const errors = mock<ErrorsService>()
        const error = { message: "plain" }
        expect(localizeError(errors, "vi", error)).toBe(error)
        expect(errors.text).not.toHaveBeenCalled()
    })
})
