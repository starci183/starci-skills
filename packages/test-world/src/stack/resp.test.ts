import assert from "node:assert/strict"
import { createServer } from "node:net"
import type { AddressInfo } from "node:net"
import { describe, it } from "node:test"
import { parseResp, redisRoundTrip } from "./resp"

describe("resp", () => {
    it("parses simple, integer, bulk, null and array replies and reports an incomplete buffer", () => {
        assert.deepEqual(parseResp(Buffer.from("+PONG\r\n"), 0)?.value, "PONG")
        assert.deepEqual(parseResp(Buffer.from(":42\r\n"), 0)?.value, 42)
        assert.deepEqual(parseResp(Buffer.from("$-1\r\n"), 0)?.value, null)
        assert.deepEqual(parseResp(Buffer.from("*2\r\n$3\r\nfoo\r\n:1\r\n"), 0)?.value, ["foo", 1])
        assert.equal(parseResp(Buffer.from("$5\r\nab"), 0), null)
    })

    it("round-trips pipelined commands over a socket and rejects an error reply", async () => {
        const seen: Array<string> = []
        const server = createServer((socket) => {
            socket.on("data", (chunk) => {
                const text = chunk.toString()
                seen.push(text)
                socket.write(text.includes("BOOM") ? "-ERR boom\r\n" : text.includes("SELECT") ? "+OK\r\n+OK\r\n" : "+PONG\r\n")
            })
        })
        await new Promise<void>((done) => server.listen(0, "127.0.0.1", done))
        const port = (server.address() as AddressInfo).port
        try {
            assert.deepEqual(await redisRoundTrip("127.0.0.1", port, [["PING"]]), ["PONG"])
            assert.deepEqual(await redisRoundTrip("127.0.0.1", port, [["SELECT", "3"], ["FLUSHDB"]]), ["OK", "OK"])
            assert.ok(seen[1]?.startsWith("*2\r\n$6\r\nSELECT\r\n$1\r\n3\r\n"))
            await assert.rejects(redisRoundTrip("127.0.0.1", port, [["BOOM"]]), /ERR boom/)
        } finally {
            server.close()
        }
    })
})
