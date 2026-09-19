import {
    encodeCommand, tryParse 
} from "./resp"

/** resp.ts is a pure codec (no providers), so these specs call the functions directly. */

describe("encodeCommand",
    () => {
        it("writes a RESP array of bulk strings with byte lengths",
            () => {
                expect(encodeCommand(["ZADD",
                    "notify:dispatch-queue",
                    "1700000000000",
                    "job-1"])).toBe(
                    "*4\r\n$4\r\nZADD\r\n$21\r\nnotify:dispatch-queue\r\n$13\r\n1700000000000\r\n$5\r\njob-1\r\n",
                )
            })

        it("counts bytes, not characters, for multibyte arguments",
            () => {
                // 'ü' is 2 bytes in utf8: a length miscount here corrupts every command after it on the wire.
                expect(encodeCommand(["ü"])).toBe("*1\r\n$2\r\nü\r\n")
            })
    })

describe("tryParse",
    () => {
        it("parses a simple string reply",
            () => {
                expect(tryParse("+OK\r\n",
                    0)).toEqual({
                    value: "OK", next: 5 
                })
            })

        it("parses an error reply into an Error value",
            () => {
                const result = tryParse("-ERR unknown command\r\n",
                    0)
                expect(result?.value).toBeInstanceOf(Error)
                expect((result?.value as Error).message).toBe("ERR unknown command")
                expect(result?.next).toBe(22)
            })

        it("parses an integer reply",
            () => {
                expect(tryParse(":42\r\n",
                    0)).toEqual({
                    value: 42, next: 5 
                })
            })

        it("parses a bulk string reply",
            () => {
                expect(tryParse("$5\r\nhello\r\n",
                    0)).toEqual({
                    value: "hello", next: 11 
                })
            })

        it("parses a null bulk string",
            () => {
                expect(tryParse("$-1\r\n",
                    0)).toEqual({
                    value: null, next: 5 
                })
            })

        it("parses an array reply recursively",
            () => {
                expect(tryParse("*2\r\n$3\r\nfoo\r\n:7\r\n",
                    0)).toEqual({
                    value: ["foo",
                        7], next: 17 
                })
            })

        it("parses a null array",
            () => {
                expect(tryParse("*-1\r\n",
                    0)).toEqual({
                    value: null, next: 5 
                })
            })

        it("returns null while a reply is incomplete, at every level",
            () => {
                expect(tryParse("",
                    0)).toBeNull()
                expect(tryParse("+OK",
                    0)).toBeNull() // no terminator yet
                expect(tryParse("$5\r\nhel",
                    0)).toBeNull() // body still arriving
                expect(tryParse("*2\r\n+OK\r\n",
                    0)).toBeNull() // second array element still arriving
            })

        it("parses from the given offset so a buffered reply can resume mid-stream",
            () => {
                expect(tryParse("+OK\r\n:9\r\n",
                    5)).toEqual({
                    value: 9, next: 9 
                })
            })

        it("throws on an unknown type byte rather than guessing",
            () => {
                expect(() => tryParse("!x\r\n",
                    0)).toThrow(/unknown RESP type byte/)
            })
    })
