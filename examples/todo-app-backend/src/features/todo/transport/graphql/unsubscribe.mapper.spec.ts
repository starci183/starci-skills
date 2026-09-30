import { toUnsubscribeRequest, toUnsubscribeType } from "./unsubscribe.mapper"

describe("unsubscribe mapper", () => {
    it("maps the input channel to the request and the unsubscribed channel to the type", () => {
        expect(toUnsubscribeRequest({ channel: "push" })).toEqual({ channel: "push" })
        expect(toUnsubscribeType({ channel: "push", unsubscribed: true })).toEqual({ channel: "push", unsubscribed: true })
    })
})
