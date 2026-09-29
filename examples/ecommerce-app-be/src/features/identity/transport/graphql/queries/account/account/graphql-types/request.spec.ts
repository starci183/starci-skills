import {
    validate 
} from "class-validator"
import {
    AccountRequest 
} from "./request"

/** Validates the way the app's global ValidationPipe does: the decorators on the class decide what the wire may deliver. */
const errorsOf = async (value: object): Promise<number> => (await validate(Object.assign(new AccountRequest(),
    value))).length

describe("AccountRequest validation",
    () => {
        const valid = {
            personId: "8f14e45f-ceea-467a-9575-4c3bb6d4b0d1" 
        }


        it("accepts a person id",
            async () => {
                expect(await errorsOf(valid)).toBe(0)
            })

        it("refuses an id past the 64 character bound",
            async () => {
                expect(await errorsOf({
                    personId: "x".repeat(65) 
                })).toBeGreaterThanOrEqual(1)
            })

        it("refuses a non-string id",
            async () => {
                expect(await errorsOf({
                    personId: 7 
                })).toBeGreaterThanOrEqual(1)
            })
    })
