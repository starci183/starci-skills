import { presignS3Get, signS3Request } from "./receipt-storage-signature.policy"

const AT = new Date("2026-10-01T12:00:00.000Z")

describe("signS3Request", () => {
    it("signs the host, exact payload hash and request date with SigV4", () => {
        const headers = signS3Request({
            method: "PUT",
            url: "https://s3.example.test/receipts/receipt-1.json",
            payload: Buffer.from("{}"),
            at: AT,
            region: "ap-southeast-1",
            accessKeyId: "AKID",
            secretAccessKey: "secret-key",
        })

        expect(headers).toEqual({
            "x-amz-date": "20261001T120000Z",
            "x-amz-content-sha256": "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
            authorization: expect.stringMatching(
                /^AWS4-HMAC-SHA256 Credential=AKID\/20261001\/ap-southeast-1\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/,
            ),
        })
    })
})

describe("presignS3Get", () => {
    it("builds an RFC 3986 encoded, expiring SigV4 URL", () => {
        const signed = presignS3Get({
            url: "https://s3.example.test/receipts/receipt-1.json",
            at: AT,
            expiresInSeconds: 900,
            region: "ap-southeast-1",
            accessKeyId: "AKID!*'()",
            secretAccessKey: "secret-key",
        })

        expect(signed).toContain("https://s3.example.test/receipts/receipt-1.json?")
        expect(signed).toContain("X-Amz-Algorithm=AWS4-HMAC-SHA256")
        expect(signed).toContain("X-Amz-Credential=AKID%21%2A%27%28%29%2F20261001%2Fap-southeast-1%2Fs3%2Faws4_request")
        expect(signed).toContain("X-Amz-Date=20261001T120000Z")
        expect(signed).toContain("X-Amz-Expires=900")
        expect(signed).toContain("X-Amz-SignedHeaders=host")
        expect(signed).toMatch(/&X-Amz-Signature=[0-9a-f]{64}$/)
    })
})
