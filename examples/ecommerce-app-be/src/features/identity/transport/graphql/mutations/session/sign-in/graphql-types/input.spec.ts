import {
    validate 
} from "class-validator"
import {
    SignInInput 
} from "./input"

/** Validates the way the app's global ValidationPipe does: the decorators on the class decide what the wire may deliver. */
const errorsOf = async (value: object): Promise<number> => (await validate(Object.assign(new SignInInput(),
    value))).length

describe("SignInInput validation",
    () => {
        const valid = {
            email: "demo@ecommerce.dev", password: "ecommerce-demo" 
        }


        it("accepts an email and password",
            async () => {
                expect(await errorsOf(valid)).toBe(0)
            })

        it("refuses an email past the 320 character bound",
            async () => {
                expect(await errorsOf({
                    ...valid, email: "a".repeat(321) 
                })).toBeGreaterThanOrEqual(1)
            })

        it("refuses a password past the 256 character bound",
            async () => {
                expect(await errorsOf({
                    ...valid, password: "p".repeat(257) 
                })).toBeGreaterThanOrEqual(1)
            })

        it("refuses non-string values",
            async () => {
                expect(await errorsOf({
                    email: 42, password: null 
                })).toBeGreaterThanOrEqual(2)
            })
    })
