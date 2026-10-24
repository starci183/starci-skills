import { createHmac } from "node:crypto"
import { Test } from "@nestjs/testing"
import { decodeCursor, encodeCursor, pageOf } from "./page-cursor.policy"

const SUBJECT: unique symbol = Symbol("primitives/page-cursor.policy")
const subjectFunctions = () => ({ decodeCursor, encodeCursor, pageOf })

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: subjectFunctions }],
    }).compile()
    return moduleRef.get<ReturnType<typeof subjectFunctions>>(SUBJECT)
}

const KEY = "cursor-key-one"
const position = { sortValue: "2026-10-24 01:02:03.123456+00", id: "order-1" }

/** A cursor whose body is the given text, correctly signed: what only the key holder could make. */
const signedCursor = (bodyText: string, key: string): string => {
    const body = Buffer.from(bodyText).toString("base64url")
    return `${body}.${createHmac("sha256", key).update(body).digest().toString("base64url")}`
}

describe("encodeCursor and decodeCursor", () => {
    it("gives back the position a cursor was made from", async () => {
        const subject = await build()

        expect(subject.decodeCursor(subject.encodeCursor(position, KEY), KEY)).toEqual(position)
    })

    it("makes a cursor that shows no plain position", async () => {
        const subject = await build()

        expect(subject.encodeCursor(position, KEY)).not.toContain("order-1")
    })

    it("refuses a cursor signed with another key", async () => {
        const subject = await build()

        expect(subject.decodeCursor(subject.encodeCursor(position, "other-key"), KEY)).toBeNull()
    })

    it("refuses a cursor whose body was edited", async () => {
        const subject = await build()
        const [, mac = ""] = subject.encodeCursor(position, KEY).split(".")
        const forged = Buffer.from(JSON.stringify(["2000-01-01", "order-9"])).toString("base64url")

        expect(subject.decodeCursor(`${forged}.${mac}`, KEY)).toBeNull()
    })

    it("refuses a token that is not two parts", async () => {
        const subject = await build()

        expect(subject.decodeCursor("not-a-cursor", KEY)).toBeNull()
        expect(subject.decodeCursor("a.b.c", KEY)).toBeNull()
        expect(subject.decodeCursor(".mac", KEY)).toBeNull()
    })

    it("refuses a signature of the wrong length", async () => {
        const subject = await build()
        const [body = ""] = subject.encodeCursor(position, KEY).split(".")

        expect(subject.decodeCursor(`${body}.AA`, KEY)).toBeNull()
    })

    it("refuses a signed body that is not a pair of strings", async () => {
        const subject = await build()

        expect(subject.decodeCursor(signedCursor(JSON.stringify(["only-one"]), KEY), KEY)).toBeNull()
        expect(subject.decodeCursor(signedCursor(JSON.stringify([1, 2]), KEY), KEY)).toBeNull()
        expect(subject.decodeCursor(signedCursor(JSON.stringify({ sortValue: "a", id: "b" }), KEY), KEY)).toBeNull()
    })

    it("refuses a signed body that is not JSON", async () => {
        const subject = await build()

        expect(subject.decodeCursor(signedCursor("not json", KEY), KEY)).toBeNull()
    })
})

describe("pageOf", () => {
    const rows = [
        { id: "a", at: "t3" },
        { id: "b", at: "t2" },
        { id: "c", at: "t1" },
    ]
    const request = (first: number) => ({
        first,
        key: KEY,
        positionOf: (row: (typeof rows)[number]) => ({ sortValue: row.at, id: row.id }),
        itemOf: (row: (typeof rows)[number]) => row.id,
    })

    it("hides the extra row and says a next page exists, ending at the last row shown", async () => {
        const subject = await build()

        const page = subject.pageOf(rows, request(2))

        expect(page.items).toEqual(["a", "b"])
        expect(page.hasNextPage).toBe(true)
        expect(subject.decodeCursor(page.endCursor ?? "", KEY)).toEqual({ sortValue: "t2", id: "b" })
    })

    it("says there is no next page when the read found no extra row", async () => {
        const subject = await build()

        const page = subject.pageOf(rows, request(3))

        expect(page.items).toEqual(["a", "b", "c"])
        expect(page.hasNextPage).toBe(false)
    })

    it("answers an empty page with no cursor", async () => {
        const subject = await build()

        expect(subject.pageOf([], request(2))).toEqual({ items: [], endCursor: null, hasNextPage: false })
    })
})
