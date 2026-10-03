import { Test } from "@nestjs/testing"
import { IsString, MinLength } from "class-validator"
import { HttpSecurityErrorCode } from "./errors/http-security.error"
import { RequestValidationService } from "./request-validation.service"

class SignUpBody {
    @IsString()
    @MinLength(3)
    name!: string
}

describe("RequestValidationService", () => {
    const build = async (): Promise<RequestValidationService> => {
        const moduleRef = await Test.createTestingModule({ providers: [RequestValidationService] }).compile()
        return moduleRef.get(RequestValidationService)
    }
    const metadata = { type: "body" as const, metatype: SignUpBody }

    it("returns the body as an instance of its declared class", async () => {
        const body = await (await build()).transform({ name: "An Nguyen" }, metadata)

        expect(body).toBeInstanceOf(SignUpBody)
        expect(body).toEqual({ name: "An Nguyen" })
    })

    it("refuses an unknown property, naming it", async () => {
        await expect((await build()).transform({ name: "An Nguyen", admin: true }, metadata)).rejects.toMatchObject({
            code: HttpSecurityErrorCode.RequestInvalid,
            params: { fields: "admin" },
        })
    })

    it("refuses an invalid value, naming the offending fields", async () => {
        await expect((await build()).transform({ name: "A" }, metadata)).rejects.toMatchObject({
            code: HttpSecurityErrorCode.RequestInvalid,
            params: { fields: "name" },
        })
    })
})
