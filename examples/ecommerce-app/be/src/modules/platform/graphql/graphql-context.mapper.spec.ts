import { mock } from "@starci/jest-preset"
import type { Request, Response } from "express"
import {
    connectionRequestOf,
    graphqlContextOf,
    isConnectionExtra,
    rememberAuthorization,
} from "./graphql-context.mapper"
import type { ConnectionExtra, ConnectionParams } from "./graphql.contracts"

const connectionExtra = (
    headers: ConnectionExtra["request"]["headers"],
    remoteAddress?: string,
    authorization?: string,
): ConnectionExtra => ({
    request: { headers, socket: { remoteAddress } },
    authorization,
})

describe("graphql context mapper", () => {
    describe("connectionRequestOf", () => {
        it("builds an empty GET request when a subscription has no extras", () => {
            expect(connectionRequestOf(undefined)).toEqual({
                headers: { authorization: undefined },
                method: "GET",
                ip: undefined,
            })
        })

        it("prefers the authorization remembered from the connection params", () => {
            const extra = connectionExtra(
                { authorization: "Bearer upgrade", "x-forwarded-for": "203.0.113.8" },
                "198.51.100.7",
                "Bearer connection",
            )

            expect(connectionRequestOf(extra)).toEqual({
                headers: { authorization: "Bearer connection", "x-forwarded-for": "203.0.113.8" },
                method: "GET",
                ip: "198.51.100.7",
            })
        })

        it("falls back to the authorization header of the upgrade request", () => {
            const extra = connectionExtra({ authorization: "Bearer upgrade" }, "198.51.100.7")

            expect(connectionRequestOf(extra).headers.authorization).toBe("Bearer upgrade")
        })
    })

    describe("isConnectionExtra", () => {
        it.each<[unknown, boolean]>([
            [undefined, false],
            [null, false],
            ["connection", false],
            [{}, false],
            [{ request: { headers: {}, socket: {} } }, true],
        ])("returns %s for %s", (value, expected) => {
            expect(isConnectionExtra(value)).toBe(expected)
        })
    })

    describe("rememberAuthorization", () => {
        it.each<{ params: ConnectionParams | undefined; expected: string | undefined }>([
            { params: { authorization: "Bearer connection" }, expected: "Bearer connection" },
            { params: { authorization: 42 }, expected: undefined },
            { params: undefined, expected: undefined },
        ])("keeps only a string authorization param", ({ params, expected }) => {
            const extra = connectionExtra({}, undefined, "Bearer old")

            rememberAuthorization(params, extra)

            expect(extra.authorization).toBe(expected)
        })
    })

    describe("graphqlContextOf", () => {
        it("keeps the HTTP request and response pair unchanged", () => {
            const req = mock<Request>({
                headers: { authorization: "Bearer http" },
                method: "POST",
                ip: "203.0.113.10",
            })
            const res = mock<Response>()
            const extra = connectionExtra({}, undefined, "Bearer connection")

            expect(graphqlContextOf({ req, res, extra })).toEqual({ req, res })
        })

        it("builds the request of a subscription operation from its connection extras", () => {
            const extra = connectionExtra({ authorization: "Bearer upgrade" }, "198.51.100.7", "Bearer connection")

            expect(graphqlContextOf({ extra })).toEqual({
                req: {
                    headers: { authorization: "Bearer connection" },
                    method: "GET",
                    ip: "198.51.100.7",
                },
                res: undefined,
            })
        })
    })
})
