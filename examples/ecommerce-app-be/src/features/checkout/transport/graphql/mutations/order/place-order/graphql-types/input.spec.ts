import {
    validate 
} from "class-validator"
import {
    PlaceOrderInput 
} from "./input"

/** Validates the way the app's global ValidationPipe does: the decorators on the class decide what the wire may deliver. */
const errorsOf = async (value: object): Promise<number> => (await validate(Object.assign(new PlaceOrderInput(),
    value))).length

describe("PlaceOrderInput validation",
    () => {
        const valid = {
            idempotencyKey: "key-1" 
        }


        it("accepts a replay key",
            async () => {
                expect(await errorsOf(valid)).toBe(0)
            })

        it("accepts no key at all: idempotency is optional",
            async () => {
                expect(await errorsOf({
                })).toBe(0)
            })

        it("refuses a key past the 200 character bound",
            async () => {
                expect(await errorsOf({
                    idempotencyKey: "k".repeat(201) 
                })).toBeGreaterThanOrEqual(1)
            })

        it("refuses a non-string key",
            async () => {
                expect(await errorsOf({
                    idempotencyKey: 12 
                })).toBeGreaterThanOrEqual(1)
            })
    })
