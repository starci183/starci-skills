import assert from "node:assert/strict"
import { createServer } from "node:http"
import type { IncomingMessage, ServerResponse } from "node:http"
import test from "node:test"
import { graphqlEnvelopeOf, createTestApi } from "./graphql"
import { createHttpClient, createTestHttp } from "./http-client"
import { pollUntil } from "./poll"
import { freePorts } from "./ports"

const collect = (request: IncomingMessage): Promise<Buffer> =>
    new Promise((resolve) => {
        const chunks: Array<Buffer> = []
        request.on("data", (chunk: Buffer) => chunks.push(chunk))
        request.on("end", () => resolve(Buffer.concat(chunks)))
    })

const serve = async (handler: (request: IncomingMessage, response: ServerResponse, body: Buffer) => void): Promise<{ url: string; close: () => Promise<void> }> => {
    const server = createServer((request, response) => {
        collect(request).then((body) => handler(request, response, body))
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    const port = typeof address === "object" && address !== null ? address.port : 0
    return { url: `http://127.0.0.1:${port}`, close: () => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()) }) }
}

test("a refusal resolves with status, body and lower-cased headers; json is parsed, text is kept", async () => {
    const door = await serve((request, response) => {
        if (request.url === "/json") {
            response.writeHead(403, { "content-type": "application/json", "x-Reason": "nope" })
            response.end(JSON.stringify({ error: "forbidden" }))
        } else {
            response.writeHead(200, { "content-type": "text/plain" })
            response.end("plain")
        }
    })
    try {
        const http = createHttpClient({ baseUrl: door.url })
        const refused = await http.get<{ error: string }>("/json")
        assert.equal(refused.status, 403)
        assert.deepEqual(refused.body, { error: "forbidden" })
        assert.equal(refused.headers["x-reason"], "nope")
        assert.equal((await http.get<string>("/text")).body, "plain")
    } finally {
        await door.close()
    }
})

test("a Buffer body goes out as raw bytes, an object as json, and the bearer rides on every call", async () => {
    const seen: Array<{ type: string | undefined; auth: string | undefined; body: string; method: string }> = []
    const door = await serve((request, response, body) => {
        seen.push({ type: request.headers["content-type"], auth: request.headers.authorization, body: body.toString("hex"), method: request.method ?? "" })
        response.writeHead(200, { "content-type": "application/json" })
        response.end("{}")
    })
    try {
        const http = createTestHttp(door.url).as("tok")
        await http.put("/upload", Buffer.from([1, 2, 3]))
        await http.post("/json", { a: 1 })
        await http.delete("/x")
        assert.deepEqual(seen.map((s) => [s.method, s.type, s.auth]), [
            ["PUT", "application/octet-stream", "Bearer tok"],
            ["POST", "application/json", "Bearer tok"],
            ["DELETE", undefined, "Bearer tok"],
        ])
        assert.equal(seen[0]?.body, "010203")
        assert.equal(seen[1]?.body, Buffer.from('{"a":1}').toString("hex"))
    } finally {
        await door.close()
    }
})

test("graphql resolves the operation registry key, sends accept-language and folds the error code", async () => {
    const requests: Array<{ query: string; language: string | undefined; auth: string | undefined }> = []
    const door = await serve((request, response, body) => {
        const parsed = JSON.parse(body.toString("utf8")) as { query: string }
        requests.push({ query: parsed.query, language: request.headers["accept-language"], auth: request.headers.authorization })
        response.writeHead(200, { "content-type": "application/json" })
        response.end(JSON.stringify({ errors: [{ message: "denied", extensions: { code: "IDENTITY_NOT_FOUND" } }], data: null }))
    })
    try {
        const api = createTestApi({
            baseUrl: door.url,
            graphqlPath: "/graphql",
            operations: { tasks: "query { tasks { taskId } }" },
            signIn: async () => ({ sessionToken: "t", personId: "p" }),
        })
        const denied = await api.graphql<unknown>("tasks", {}, "en")
        assert.equal(denied.errorCode, "IDENTITY_NOT_FOUND")
        assert.equal(denied.errorMessage, "denied")
        assert.equal(denied.data, null)
        await api.as("session").read("query { raw }")
        assert.equal(requests[0]?.query, "query { tasks { taskId } }")
        assert.equal(requests[0]?.language, "en")
        assert.equal(requests[1]?.query, "query { raw }")
        assert.equal(requests[1]?.auth, "Bearer session")
        assert.deepEqual(await api.signIn("a", "b"), { sessionToken: "t", personId: "p" })
    } finally {
        await door.close()
    }
})

test("a graphql body that is not an object degrades into an unparsableBody note", () => {
    const observed = graphqlEnvelopeOf<unknown>(502, "<html>bad gateway</html>", Date.now())
    assert.equal(observed.httpStatus, 502)
    assert.deepEqual(observed.raw, { unparsableBody: "<html>bad gateway</html>" })
    assert.equal(observed.errorCode, null)
})

test("pollUntil answers the first truthy observation and names the label and last observation at the deadline", async () => {
    let calls = 0
    assert.equal(await pollUntil("third try", async () => (++calls === 3 ? "done" : null), 2_000, 5), "done")
    await assert.rejects(pollUntil("never", async () => 0, 30, 5), /waiting for never; last observation: 0/)
})

test("freePorts answers distinct ports", async () => {
    const ports = await freePorts(4)
    assert.equal(new Set(ports).size, 4)
})
