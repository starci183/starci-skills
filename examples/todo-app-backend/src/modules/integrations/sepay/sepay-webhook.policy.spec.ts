import { Secret } from "@modules/platform/config"
import { isWebhookAuthorized } from "./sepay-webhook.policy"

const secret = new Secret("hook-secret")

describe("isWebhookAuthorized", () => {
    it("accepts exactly the Bearer header carrying the shared secret", () => {
        expect(isWebhookAuthorized("Bearer hook-secret", secret)).toBe(true)
    })

    it("refuses an absent header", () => {
        expect(isWebhookAuthorized(undefined, secret)).toBe(false)
    })

    it("refuses a wrong secret, a wrong scheme, a wrong case and padding", () => {
        for (const presented of ["Bearer wrong", "Basic hook-secret", "bearer hook-secret", "Bearer hook-secret ", "hook-secret", ""]) {
            expect(isWebhookAuthorized(presented, secret)).toBe(false)
        }
    })
})
