import { IsString, MaxLength } from "class-validator"
import { HttpSecurityError, HttpSecurityErrorCode } from "./errors/http-security.error"
import { RequestValidationPipeService } from "./request-validation.service"

class SampleInput {
    @IsString()
    @MaxLength(3)
    name!: string
}

const metadata = { type: "body" as const, metatype: SampleInput }

describe("RequestValidationPipeService", () => {
    const pipe = new RequestValidationPipeService()

    it("passes a valid body", async () => {
        await expect(pipe.transform({ name: "abc" }, metadata)).resolves.toEqual({ name: "abc" })
    })

    it("refuses an invalid field with the capability error naming it", async () => {
        const call = pipe.transform({ name: "abcdef" }, metadata)
        await expect(call).rejects.toBeInstanceOf(HttpSecurityError)
        await expect(call).rejects.toMatchObject({
            code: HttpSecurityErrorCode.RequestInvalid,
            params: { fields: "name" },
        })
    })

    it("refuses a property the input does not declare", async () => {
        await expect(pipe.transform({ name: "abc", extra: 1 }, metadata)).rejects.toBeInstanceOf(HttpSecurityError)
    })
})
