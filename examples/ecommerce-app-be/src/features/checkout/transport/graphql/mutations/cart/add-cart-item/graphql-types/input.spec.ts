import {
    validate 
} from "class-validator"
import {
    AddCartItemInput 
} from "./input"

/** Validates the way the app's global ValidationPipe does: the decorators on the class decide what the wire may deliver. */
const errorsOf = async (value: object): Promise<number> => (await validate(Object.assign(new AddCartItemInput(),
    value))).length

describe("AddCartItemInput validation",
    () => {
        const valid = {
            productId: "sku-mug", quantity: 3 
        }


        it("accepts a product id and an integer quantity",
            async () => {
                expect(await errorsOf(valid)).toBe(0)
            })

        it("refuses a product id past the 64 character bound",
            async () => {
                expect(await errorsOf({
                    ...valid, productId: "s".repeat(65) 
                })).toBeGreaterThanOrEqual(1)
            })

        it("refuses a fractional quantity",
            async () => {
                expect(await errorsOf({
                    ...valid, quantity: 1.5 
                })).toBeGreaterThanOrEqual(1)
            })

        it("refuses a quantity past the 1,000,000 bound",
            async () => {
                expect(await errorsOf({
                    ...valid, quantity: 1_000_001 
                })).toBeGreaterThanOrEqual(1)
            })
    })
