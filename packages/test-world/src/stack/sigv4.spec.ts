import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { amzDateOf, canonicalQuery, signV4 } from "./sigv4"

describe("signV4", () => {
    it("matches the published AWS get-vanilla test vector", () => {
        const signed = signV4({
            method: "GET",
            path: "/",
            query: {},
            headers: { host: "example.amazonaws.com", "x-amz-date": "20150830T123600Z" },
            body: "",
            accessKey: "AKIDEXAMPLE",
            secretKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
            region: "us-east-1",
            service: "service",
            amzDate: "20150830T123600Z",
        })
        assert.equal(signed.signature, "5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31")
        assert.equal(
            signed.authorization,
            "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31",
        )
    })

    it("sorts and encodes the query and formats the amz date", () => {
        assert.equal(canonicalQuery({ b: "2 3", a: "x/y" }), "a=x%2Fy&b=2%203")
        assert.equal(amzDateOf(new Date("2015-08-30T12:36:00.000Z")), "20150830T123600Z")
    })
})
