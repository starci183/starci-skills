import { IsIn, IsInt, IsString, Max, MaxLength, Min, ValidateNested } from "class-validator"
import { Type } from "class-transformer"
import { HttpSecurityErrorCode } from "./errors/http-security.error"
import { OperationValidationService } from "./operation-validation.service"

class PlanAsk {
    @IsInt()
    @Min(1)
    @Max(10)
    limit!: number
}

class PlanReadEnvelope {
    @IsIn(["plan.read@1"])
    operation!: string

    @IsString()
    @MaxLength(64)
    requestId!: string

    @ValidateNested()
    @Type(() => PlanAsk)
    input!: PlanAsk
}

describe("OperationValidationService", () => {
    const build = (): OperationValidationService => new OperationValidationService(PlanReadEnvelope)
    const valid = { operation: "plan.read@1", requestId: "r-1", input: { limit: 5 } }
    /** What a route whose body is typed by an alias leaves for the pipe to read: no class. */
    const metadata = { type: "body" as const, metatype: Object }

    it("returns the body as an instance of the envelope class, whatever the route type leaves at run time", async () => {
        const body: unknown = await build().transform(valid, metadata)

        expect(body).toBeInstanceOf(PlanReadEnvelope)
        expect(body).toEqual(valid)
    })

    it("refuses an operation the table does not serve", async () => {
        await expect(build().transform({ ...valid, operation: "plan.other@1" }, metadata)).rejects.toMatchObject({
            code: HttpSecurityErrorCode.RequestInvalid,
            params: { fields: "operation" },
        })
    })

    it("refuses an input out of bounds, naming the envelope field that holds it", async () => {
        await expect(build().transform({ ...valid, input: { limit: 11 } }, metadata)).rejects.toMatchObject({
            code: HttpSecurityErrorCode.RequestInvalid,
            params: { fields: "input" },
        })
    })

    it("refuses a property the envelope does not declare", async () => {
        await expect(build().transform({ ...valid, admin: true }, metadata)).rejects.toMatchObject({
            code: HttpSecurityErrorCode.RequestInvalid,
            params: { fields: "admin" },
        })
    })
})
