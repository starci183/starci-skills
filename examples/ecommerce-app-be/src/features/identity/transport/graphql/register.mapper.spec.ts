import { toRegisterRequest, toRegisterType } from "./register.mapper"

describe("register mapper", () => {
    it("maps the input to the request and the person to the type", () => {
        expect(toRegisterRequest({ email: "a@example.com", password: "secret-pass" })).toEqual({
            email: "a@example.com",
            password: "secret-pass",
        })
        expect(toRegisterType({ personId: "p-1" })).toEqual({ personId: "p-1" })
    })
})
