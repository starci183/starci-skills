import { Test } from "@nestjs/testing"
import { IsInt, IsString } from "class-validator"
import { HttpSecurityError, HttpSecurityErrorCode } from "./errors/http-security.error"
import { RequestValidationPipe } from "./request-validation.service"

class TitleBody {
    @IsString()
    title!: string

    @IsInt()
    size!: number
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [RequestValidationPipe] }).compile()
    return moduleRef.get(RequestValidationPipe)
}

describe("RequestValidationPipe", () => {
    describe("transform", () => {
        it("transforms a valid body into an instance of its declared type", async () => {
            const pipe = await build()

            const body = await pipe.transform({ title: "Write", size: 3 }, { type: "body", metatype: TitleBody })

            expect(body).toBeInstanceOf(TitleBody)
            expect(body).toEqual({ title: "Write", size: 3 })
        })

        it("refuses an unknown property with the capability error naming it", async () => {
            const pipe = await build()

            const failure = await pipe.transform({ title: "Write", size: 3, extra: true }, { type: "body", metatype: TitleBody }).catch((error: unknown) => error)

            expect(failure).toBeInstanceOf(HttpSecurityError)
            expect(failure).toMatchObject({ code: HttpSecurityErrorCode.RequestInvalid, params: { fields: "extra" } })
        })

        it("names every offending field in the refusal", async () => {
            const pipe = await build()

            const failure = await pipe.transform({ title: 4, size: "x" }, { type: "body", metatype: TitleBody }).catch((error: unknown) => error)

            expect(failure).toMatchObject({ code: HttpSecurityErrorCode.RequestInvalid, params: { fields: "title, size" } })
        })
    })
})
