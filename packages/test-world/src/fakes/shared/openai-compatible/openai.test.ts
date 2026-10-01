import assert from "node:assert/strict"
import { test } from "node:test"
import { createFakeHandles } from "../../framework/bridge"
import type { FakeStartContext } from "../../framework/contracts"
import { FakesHost } from "../../framework/host"
import type { OpenAiCompatibleClient, OpenAiCompatibleOptions } from "./index"
import { openaiCompatibleFake } from "./index"

const start: FakeStartContext = { runId: "run", secret: (label) => `s-${label}`, now: () => new Date() }

interface Running {
    readonly baseUrl: string
    readonly apiKey: string
    readonly client: OpenAiCompatibleClient
}

const withFake = async (run: (running: Running) => Promise<void>, options?: OpenAiCompatibleOptions): Promise<void> => {
    const definitions = { llm: openaiCompatibleFake(options) }
    const host = new FakesHost(definitions, start)
    const started = await host.start()
    try {
        const handle = createFakeHandles(definitions, started.controlUrl, () => "")["llm"]
        assert.ok(handle)
        const values = started.fakes["llm"]?.values ?? {}
        await run({ baseUrl: values["baseUrl"] ?? "", apiKey: values["apiKey"] ?? "", client: handle as OpenAiCompatibleClient })
    } finally {
        await host.close()
    }
}

const post = (url: string, body: unknown): Promise<Response> =>
    fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })

test("models and values", async () => {
    await withFake(async ({ baseUrl, apiKey, client }) => {
        assert.match(baseUrl, /\/v1$/)
        assert.equal(apiKey, "s-openai-compatible-api-key")
        const list = (await (await fetch(`${baseUrl}/models`)).json()) as { data: Array<{ id: string }> }
        assert.deepEqual(
            list.data.map((model) => model.id),
            ["fake-chat", "fake-embedding"],
        )
        await client.setModels(["qwen"])
        const after = (await (await fetch(`${baseUrl}/models`)).json()) as { data: Array<{ id: string }> }
        assert.deepEqual(
            after.data.map((model) => model.id),
            ["qwen"],
        )
    })
})

test("chat completion: echo default, scripted FIFO replies, tool calls, recorded prompt", async () => {
    await withFake(async ({ baseUrl, client }) => {
        const echo = (await (await post(`${baseUrl}/chat/completions`, { model: "m", messages: [{ role: "user", content: "hello" }] })).json()) as {
            choices: Array<{ message: { content: string }; finish_reason: string }>
            usage: { total_tokens: number }
        }
        assert.equal(echo.choices[0]?.message.content, "Echo: hello")
        assert.equal(echo.choices[0]?.finish_reason, "stop")
        assert.ok(echo.usage.total_tokens > 0)
        await client.reply({ content: "first" })
        await client.reply({ toolCalls: [{ name: "lookup", arguments: { q: 1 } }] })
        const first = (await (await post(`${baseUrl}/chat/completions`, { messages: [] })).json()) as {
            choices: Array<{ message: { content: string } }>
        }
        assert.equal(first.choices[0]?.message.content, "first")
        const second = (await (await post(`${baseUrl}/chat/completions`, { messages: [] })).json()) as {
            choices: Array<{ message: { tool_calls: Array<{ function: { name: string; arguments: string } }> }; finish_reason: string }>
        }
        assert.equal(second.choices[0]?.finish_reason, "tool_calls")
        assert.equal(second.choices[0]?.message.tool_calls[0]?.function.name, "lookup")
        assert.equal(second.choices[0]?.message.tool_calls[0]?.function.arguments, '{"q":1}')
        const seen = await client.chatRequests()
        assert.equal(seen.length, 3)
        assert.equal(seen[0]?.messages?.[0]?.content, "hello")
        const recorded = await client.requests()
        assert.ok(recorded[0]?.body.includes('"hello"'))
    })
})

test("streaming: SSE framing, usage when asked, ends with [DONE]", async () => {
    await withFake(async ({ baseUrl, client }) => {
        await client.reply({ content: "one two three" })
        const response = await post(`${baseUrl}/chat/completions`, {
            stream: true,
            stream_options: { include_usage: true },
            messages: [{ role: "user", content: "x" }],
        })
        assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/)
        const events = (await response.text()).split("\n\n").filter((event) => event !== "")
        assert.ok(events.every((event) => event.startsWith("data: ")))
        assert.equal(events[events.length - 1], "data: [DONE]")
        const chunks = events.slice(0, -1).map(
            (event) =>
                JSON.parse(event.slice(6)) as {
                    choices: Array<{ delta: { content?: string }; finish_reason: string | null }>
                    usage?: unknown
                },
        )
        assert.equal(chunks.map((chunk) => chunk.choices[0]?.delta.content ?? "").join(""), "one two three")
        assert.ok(chunks.find((chunk) => chunk.choices[0]?.finish_reason === "stop"))
        const usageChunk = chunks[chunks.length - 1]
        assert.deepEqual(usageChunk?.choices, [])
        assert.ok(usageChunk?.usage)
        const plain = await (await post(`${baseUrl}/chat/completions`, { stream: true, messages: [] })).text()
        assert.ok(!plain.includes('"usage"'))
    })
})

test("truncated stream: the client sees a premature close after N events", async () => {
    await withFake(async ({ baseUrl, client }) => {
        await client.reply({ content: "a b c d e f" })
        await client.failNext({ truncateStream: { afterEvents: 3 } })
        const response = await post(`${baseUrl}/chat/completions`, { stream: true, messages: [] })
        await assert.rejects(response.text())
        const again = await (await post(`${baseUrl}/chat/completions`, { stream: true, messages: [] })).text()
        assert.ok(again.endsWith("data: [DONE]\n\n"))
    })
})

test("failures: OpenAI-style error body and timeout", async () => {
    await withFake(async ({ baseUrl, client }) => {
        await client.failNext({ status: 429 })
        const limited = await post(`${baseUrl}/chat/completions`, { messages: [] })
        assert.equal(limited.status, 429)
        const body = (await limited.json()) as { error: { message: string; type: string; code: string } }
        assert.equal(body.error.type, "rate_limit_error")
        assert.equal(typeof body.error.message, "string")
        await client.failNext({ timeout: true, match: { pathStartsWith: "/v1/embeddings" } })
        await assert.rejects(
            fetch(`${baseUrl}/embeddings`, {
                method: "POST",
                body: JSON.stringify({ input: "x" }),
                signal: AbortSignal.timeout(200),
            }),
        )
    })
})

test("embeddings are deterministic, honour dimensions and encoding", async () => {
    await withFake(async ({ baseUrl, client }) => {
        const call = async (
            body: unknown,
        ): Promise<{ data: Array<{ index: number; embedding: Array<number> | string }>; usage: { total_tokens: number } }> =>
            (await (await post(`${baseUrl}/embeddings`, body)).json()) as never
        const one = await call({ model: "fake-embedding", input: ["alpha", "beta", "alpha"] })
        assert.deepEqual(
            one.data.map((item) => item.index),
            [0, 1, 2],
        )
        assert.deepEqual(one.data[0]?.embedding, one.data[2]?.embedding)
        assert.notDeepEqual(one.data[0]?.embedding, one.data[1]?.embedding)
        const vector = one.data[0]?.embedding as Array<number>
        assert.equal(vector.length, 8)
        assert.ok(one.usage.total_tokens > 0)
        const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
        assert.ok(Math.abs(norm - 1) < 1e-6)
        assert.deepEqual((await call({ input: "alpha" })).data[0]?.embedding, vector)
        assert.equal((await call({ input: "alpha", dimensions: 20 })).data[0]?.embedding.length, 20)
        await client.setEmbeddingDimensions(3)
        assert.equal((await call({ input: "alpha" })).data[0]?.embedding.length, 3)
        const b64 = await call({ input: "alpha", encoding_format: "base64" })
        assert.equal(Buffer.from(String(b64.data[0]?.embedding), "base64").length, 12)
    })
})

test("legacy completions, per-model dimensions and unknown routes", async () => {
    await withFake(
        async ({ baseUrl, client }) => {
            await client.reply({ content: "done" })
            const completion = (await (await post(`${baseUrl}/completions`, { model: "m", prompt: "p" })).json()) as {
                choices: Array<{ text: string }>
            }
            assert.equal(completion.choices[0]?.text, "done")
            const sized = (await (await post(`${baseUrl}/embeddings`, { model: "big", input: "x" })).json()) as {
                data: Array<{ embedding: Array<number> }>
            }
            assert.equal(sized.data[0]?.embedding.length, 16)
            assert.equal((await fetch(`${baseUrl}/nothing`)).status, 404)
        },
        { embeddingDimensionsByModel: { big: 16 } },
    )
})
