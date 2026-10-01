import assert from "node:assert/strict"
import { createServer } from "node:http"
import test from "node:test"
import type { RunKeycloak } from "../stack/contracts"
import { createKeycloakAdmin } from "./keycloak"

test("rotateClientSecret finds the client by clientId in the repository realm and answers the new secret", async () => {
    const calls: Array<string> = []
    const server = createServer((request, response) => {
        calls.push(`${request.method} ${request.url}`)
        response.setHeader("content-type", "application/json")
        if (request.url === "/realms/master/protocol/openid-connect/token") response.end(JSON.stringify({ access_token: "admin-token" }))
        else if (request.url?.startsWith("/admin/realms/shop-realm/clients?clientId=api")) response.end(JSON.stringify([{ id: "uuid-1" }]))
        else if (request.url === "/admin/realms/shop-realm/clients/uuid-1/client-secret" && request.method === "POST") {
            assert.equal(request.headers.authorization, "Bearer admin-token")
            response.end(JSON.stringify({ type: "secret", value: "new-secret" }))
        } else if (request.url?.includes("clientId=ghost")) response.end("[]")
        else {
            response.statusCode = 404
            response.end("{}")
        }
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    const port = typeof address === "object" && address !== null ? address.port : 0
    try {
        const run: RunKeycloak = { host: "127.0.0.1", port: 1, directPort: port, proxy: "p", image: "i", container: "c", realm: "shop-realm", clientId: "api", adminUser: "admin", adminPassword: "pw" }
        const admin = createKeycloakAdmin(run)
        assert.equal(await admin.rotateClientSecret("api"), "new-secret")
        await assert.rejects(admin.rotateClientSecret("ghost"), /ghost is not in the realm shop-realm/)
        assert.equal(calls.includes("POST /admin/realms/shop-realm/clients/uuid-1/client-secret"), true)
    } finally {
        server.closeAllConnections()
        server.close()
    }
})

test("events and sessions read a person's user events and live sessions of the repository realm through the admin API", async () => {
    const calls: Array<string> = []
    const server = createServer((request, response) => {
        calls.push(`${request.method} ${request.url} ${request.headers.authorization ?? ""}`)
        response.setHeader("content-type", "application/json")
        if (request.url === "/realms/master/protocol/openid-connect/token") response.end(JSON.stringify({ access_token: "admin-token" }))
        else if (request.url === "/admin/realms/shop-realm/events?user=p-1&max=1000") {
            response.end(
                JSON.stringify([
                    { type: "LOGOUT", userId: "p-1", sessionId: "s-1", time: 20 },
                    { type: "LOGIN", userId: "p-1", clientId: "api", sessionId: "s-1", time: 10 },
                    { type: "LOGIN_ERROR", userId: "p-1", clientId: "api", error: "invalid_user_credentials", time: 5 },
                ]),
            )
        } else if (request.url === "/admin/realms/shop-realm/users/p-1/sessions") response.end(JSON.stringify([{ id: "s-2", clients: { "c-uuid": "api" } }]))
        else {
            response.statusCode = 404
            response.end("{}")
        }
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    const port = typeof address === "object" && address !== null ? address.port : 0
    try {
        const run: RunKeycloak = { host: "127.0.0.1", port: 1, directPort: port, proxy: "p", image: "i", container: "c", realm: "shop-realm", clientId: "api", adminUser: "admin", adminPassword: "pw" }
        const admin = createKeycloakAdmin(run)
        assert.deepEqual(await admin.events("p-1"), [
            { type: "LOGOUT", userId: "p-1", clientId: null, sessionId: "s-1", error: null, time: 20 },
            { type: "LOGIN", userId: "p-1", clientId: "api", sessionId: "s-1", error: null, time: 10 },
            { type: "LOGIN_ERROR", userId: "p-1", clientId: "api", sessionId: null, error: "invalid_user_credentials", time: 5 },
        ])
        assert.deepEqual(await admin.sessions("p-1"), [{ id: "s-2", clientIds: ["api"] }])
        assert.equal(calls.filter((call) => call.startsWith("GET /admin/")).every((call) => call.endsWith("Bearer admin-token")), true)
        await assert.rejects(admin.sessions("ghost"), /reading the sessions of ghost of shop-realm answered 404/)
    } finally {
        server.closeAllConnections()
        server.close()
    }
})
