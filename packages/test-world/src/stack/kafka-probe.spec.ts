import assert from "node:assert/strict"
import { createServer } from "node:net"
import type { AddressInfo } from "node:net"
import { describe, it } from "node:test"
import { apiVersionsRequest, apiVersionsResponse, kafkaAnswers } from "./kafka-probe"

/** A broker double that answers one ApiVersions frame with `errorCode`, echoing the request's correlation id. */
const fakeBroker = async (errorCode: number): Promise<{ readonly port: number; readonly close: () => Promise<void> }> => {
    const server = createServer((socket) => {
        socket.once("data", (frame: Buffer) => {
            const response = Buffer.alloc(4 + 4 + 2 + 4)
            response.writeInt32BE(10, 0)
            response.writeInt32BE(frame.readInt32BE(8), 4)
            response.writeInt16BE(errorCode, 8)
            response.writeInt32BE(0, 10)
            socket.write(response.subarray(0, 7))
            setTimeout(() => socket.end(response.subarray(7)), 20)
        })
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    return { port: (server.address() as AddressInfo).port, close: () => new Promise((resolve) => server.close(() => resolve())) }
}

describe("kafka wire probe", () => {
    it("frames an ApiVersions v0 request: size, api key 18, version 0, correlation id, client id", () => {
        const frame = apiVersionsRequest(7, "c")
        assert.equal(frame.readInt32BE(0), frame.length - 4)
        assert.equal(frame.readInt16BE(4), 18)
        assert.equal(frame.readInt16BE(6), 0)
        assert.equal(frame.readInt32BE(8), 7)
        assert.equal(frame.readInt16BE(12), 1)
        assert.equal(frame.subarray(14).toString("utf8"), "c")
    })

    it("reads a response only once the whole frame arrived", () => {
        const whole = Buffer.from([0, 0, 0, 6, 0, 0, 0, 7, 0, 0])
        assert.equal(apiVersionsResponse(whole.subarray(0, 8)), null)
        assert.deepEqual(apiVersionsResponse(whole), { correlationId: 7, errorCode: 0 })
    })

    it("answers true for a broker that replies without error (even split across packets), false for an error or no broker", async () => {
        const healthy = await fakeBroker(0)
        const failing = await fakeBroker(35)
        try {
            assert.equal(await kafkaAnswers("127.0.0.1", healthy.port), true)
            assert.equal(await kafkaAnswers("127.0.0.1", failing.port), false)
        } finally {
            await healthy.close()
            await failing.close()
        }
        assert.equal(await kafkaAnswers("127.0.0.1", healthy.port, 500), false)
    })
})
