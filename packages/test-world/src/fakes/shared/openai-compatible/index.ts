/**
 * An OpenAI-compatible protocol fake: stands in for a self-hosted vLLM / embedding server and for OpenAI itself. Chat
 * completions (JSON and SSE), embeddings (deterministic), completions and models, with scripted replies and failure injection.
 */
import { createHash } from "node:crypto"
import type { FakeBridge, FakeClient } from "../../framework/contracts"
import { FakeControlRejected } from "../../framework/failures"
import { defineHttpFake } from "../../framework/http-fake"
import type { FakeHttpReply, FakeHttpRequest } from "../../framework/http-fake"

/** What `openaiCompatibleFake` is declared with. */
export interface OpenAiCompatibleOptions {
    /** The API key the app options receive (default: a run-stable random one). */
    readonly apiKey?: string
    /** Model ids `GET /v1/models` lists (default `["fake-chat", "fake-embedding"]`). */
    readonly models?: ReadonlyArray<string>
    /** Default embedding dimensions (default 8). */
    readonly embeddingDimensions?: number
    /** Embedding dimensions per model id; wins over the default. */
    readonly embeddingDimensionsByModel?: Readonly<Record<string, number>>
}

/** One tool call of a scripted reply. */
export interface ScriptedToolCall {
    readonly id?: string
    readonly name: string
    /** An object (serialized) or the JSON text. */
    readonly arguments: unknown
}

/** A scripted reply, served FIFO to chat and text completions. */
export interface ScriptedReply {
    readonly content?: string
    readonly toolCalls?: ReadonlyArray<ScriptedToolCall>
    /** Default `tool_calls` when there are tool calls, else `stop`. */
    readonly finishReason?: string
    /** Overrides the model id echoed in the answer. */
    readonly model?: string
}

/** A chat completion request as the app sent it. */
export interface OpenAiChatRequest {
    readonly model?: string
    readonly messages?: ReadonlyArray<{ readonly role: string; readonly content?: unknown; readonly [key: string]: unknown }>
    readonly stream?: boolean
    readonly [key: string]: unknown
}

/** The handle of the fake. */
export interface OpenAiCompatibleClient extends FakeClient {
    /** Queues a reply for the next chat/text completion (FIFO); with none queued the fake echoes the last user message. */
    reply(reply: ScriptedReply): Promise<void>
    /** Replaces the model list. */
    setModels(models: ReadonlyArray<string>): Promise<void>
    /** Changes the default embedding dimensions. */
    setEmbeddingDimensions(dimensions: number): Promise<void>
    /** The parsed bodies of the chat completion requests received, oldest first. */
    chatRequests(): Promise<ReadonlyArray<OpenAiChatRequest>>
}

interface OpenAiState {
    replies: Array<ScriptedReply>
    models: Array<string>
    dimensions: number
    chat: Array<OpenAiChatRequest>
}

const DEFAULT_MODELS = ["fake-chat", "fake-embedding"]
const DEFAULT_DIMENSIONS = 8

const errorBody = (status: number, message = "injected failure"): unknown => ({
    error: {
        message,
        type: status === 429 ? "rate_limit_error" : status >= 500 ? "server_error" : status === 401 ? "authentication_error" : "invalid_request_error",
        code: status === 429 ? "rate_limit_exceeded" : status >= 500 ? "server_error" : null,
    },
})

const jsonObject = (request: FakeHttpRequest): Record<string, unknown> | null => {
    const parsed = request.json()
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
}

const estimateTokens = (text: string): number => Math.max(1, Math.ceil(text.length / 4))

const textOf = (content: unknown): string => {
    if (typeof content === "string") return content
    if (Array.isArray(content)) {
        return content
            .map((part) => (typeof part === "object" && part !== null && "text" in part ? String((part as { text: unknown }).text) : ""))
            .join("")
    }
    return ""
}

const sseEvent = (payload: unknown): string => `data: ${JSON.stringify(payload)}\n\n`

/** Deterministic unit vector of `dimensions` floats derived from a sha256 of the input. */
export const embeddingVector = (input: string, dimensions: number): Array<number> => {
    const values: Array<number> = []
    let block = 0
    while (values.length < dimensions) {
        const digest = createHash("sha256").update(`${input}#${block}`).digest()
        for (let offset = 0; offset + 4 <= digest.length && values.length < dimensions; offset += 4) {
            values.push(digest.readUInt32BE(offset) / 0xffffffff * 2 - 1)
        }
        block += 1
    }
    const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0)) || 1
    return values.map((value) => Math.round((value / norm) * 1e8) / 1e8)
}

const inputsOf = (input: unknown): Array<string> => {
    if (typeof input === "string") return [input]
    if (Array.isArray(input)) return input.map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
    return []
}

const nextReply = (state: OpenAiState, fallback: string): ScriptedReply => state.replies.shift() ?? { content: fallback }

const toolCallsOf = (reply: ScriptedReply): Array<Record<string, unknown>> =>
    (reply.toolCalls ?? []).map((call, index) => ({
        id: call.id ?? `call_${index}`,
        type: "function",
        function: { name: call.name, arguments: typeof call.arguments === "string" ? call.arguments : JSON.stringify(call.arguments ?? {}) },
    }))

const chunkWords = (content: string): Array<string> => content.match(/\S+\s*|\s+/g) ?? []

const chat = (request: FakeHttpRequest, state: OpenAiState): FakeHttpReply => {
    const body = jsonObject(request)
    if (body === null) return { status: 400, body: errorBody(400, "the request body is not a JSON object") }
    state.chat.push(body as OpenAiChatRequest)
    const messages = Array.isArray(body["messages"]) ? (body["messages"] as Array<{ role?: string; content?: unknown }>) : []
    const lastUser = [...messages].reverse().find((message) => message.role === "user")
    const scripted = nextReply(state, `Echo: ${textOf(lastUser?.content)}`)
    const model = scripted.model ?? (typeof body["model"] === "string" ? body["model"] : (state.models[0] ?? "fake-chat"))
    const toolCalls = toolCallsOf(scripted)
    const finishReason = scripted.finishReason ?? (toolCalls.length > 0 ? "tool_calls" : "stop")
    const content = scripted.content ?? null
    const created = Math.floor(Date.now() / 1000)
    const id = `chatcmpl-${createHash("sha1").update(`${created}${state.chat.length}`).digest("hex").slice(0, 16)}`
    const promptTokens = estimateTokens(JSON.stringify(messages))
    const completionTokens = estimateTokens(`${content ?? ""}${JSON.stringify(toolCalls)}`)
    const usage = { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens }
    if (body["stream"] !== true) {
        const message: Record<string, unknown> = { role: "assistant", content }
        if (toolCalls.length > 0) message["tool_calls"] = toolCalls
        return { body: { id, object: "chat.completion", created, model, choices: [{ index: 0, message, finish_reason: finishReason }], usage } }
    }
    const frame = (delta: Record<string, unknown>, finish: string | null): string =>
        sseEvent({ id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta, finish_reason: finish }] })
    const events: Array<string> = [frame({ role: "assistant", content: "" }, null)]
    for (const piece of chunkWords(content ?? "")) events.push(frame({ content: piece }, null))
    toolCalls.forEach((call, index) => {
        events.push(frame({ tool_calls: [{ index, ...call }] }, null))
    })
    events.push(frame({}, finishReason))
    const options = body["stream_options"]
    if (typeof options === "object" && options !== null && (options as Record<string, unknown>)["include_usage"] === true) {
        events.push(sseEvent({ id, object: "chat.completion.chunk", created, model, choices: [], usage }))
    }
    events.push("data: [DONE]\n\n")
    return { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" }, stream: events }
}

const completions = (request: FakeHttpRequest, state: OpenAiState): FakeHttpReply => {
    const body = jsonObject(request)
    if (body === null) return { status: 400, body: errorBody(400, "the request body is not a JSON object") }
    const prompt = Array.isArray(body["prompt"]) ? body["prompt"].join("") : String((body["prompt"] ?? "") as string)
    const scripted = nextReply(state, `Echo: ${prompt}`)
    const model = scripted.model ?? (typeof body["model"] === "string" ? body["model"] : (state.models[0] ?? "fake-chat"))
    const text = scripted.content ?? ""
    const finishReason = scripted.finishReason ?? "stop"
    const created = Math.floor(Date.now() / 1000)
    const id = `cmpl-${createHash("sha1").update(`${created}${prompt}`).digest("hex").slice(0, 16)}`
    const promptTokens = estimateTokens(prompt)
    const completionTokens = estimateTokens(text)
    const usage = { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens }
    if (body["stream"] !== true) {
        return { body: { id, object: "text_completion", created, model, choices: [{ text, index: 0, logprobs: null, finish_reason: finishReason }], usage } }
    }
    const frame = (piece: string, finish: string | null): string =>
        sseEvent({ id, object: "text_completion", created, model, choices: [{ text: piece, index: 0, logprobs: null, finish_reason: finish }] })
    const events = [...chunkWords(text).map((piece) => frame(piece, null)), frame("", finishReason), "data: [DONE]\n\n"]
    return { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" }, stream: events }
}

const embeddings = (request: FakeHttpRequest, state: OpenAiState, byModel: Readonly<Record<string, number>>): FakeHttpReply => {
    const body = jsonObject(request)
    if (body === null) return { status: 400, body: errorBody(400, "the request body is not a JSON object") }
    const model = typeof body["model"] === "string" ? body["model"] : "fake-embedding"
    const requested = body["dimensions"]
    const dimensions = typeof requested === "number" && requested > 0 ? requested : (byModel[model] ?? state.dimensions)
    const inputs = inputsOf(body["input"])
    const base64 = body["encoding_format"] === "base64"
    const data = inputs.map((input, index) => {
        const vector = embeddingVector(input, dimensions)
        const embedding = base64 ? Buffer.from(Float32Array.from(vector).buffer).toString("base64") : vector
        return { object: "embedding", index, embedding }
    })
    const tokens = inputs.reduce((sum, input) => sum + estimateTokens(input), 0)
    return { body: { object: "list", data, model, usage: { prompt_tokens: tokens, total_tokens: tokens } } }
}

/**
 * Declares the OpenAI-compatible fake. `values`: `{ baseUrl (ending in /v1), apiKey }`. Failures: `status` answers an
 * OpenAI-style `{error:{message,type,code}}`, `timeout` holds the socket, `truncateStream: { afterEvents }` cuts a stream.
 */
export const openaiCompatibleFake = defineHttpFake<OpenAiCompatibleClient, OpenAiCompatibleOptions | undefined, OpenAiState>({
    state: (options) => ({
        replies: [],
        models: [...(options?.models ?? DEFAULT_MODELS)],
        dimensions: options?.embeddingDimensions ?? DEFAULT_DIMENSIONS,
        chat: [],
    }),
    failureBody: (status) => errorBody(status),
    values: (context) => ({
        baseUrl: `${context.url}/v1`,
        apiKey: context.options?.apiKey ?? context.secret("openai-compatible-api-key"),
    }),
    endpoints: (context) => ({ chatCompletionsUrl: `${context.url}/v1/chat/completions`, embeddingsUrl: `${context.url}/v1/embeddings` }),
    routes: [
        {
            method: "GET",
            path: "/v1/models",
            handle: (_request, context) => ({
                body: {
                    object: "list",
                    data: context.state.models.map((id) => ({ id, object: "model", created: 1_700_000_000, owned_by: "fake" })),
                },
            }),
        },
        { method: "POST", path: "/v1/chat/completions", handle: (request, context) => chat(request, context.state) },
        { method: "POST", path: "/v1/completions", handle: (request, context) => completions(request, context.state) },
        {
            method: "POST",
            path: "/v1/embeddings",
            handle: (request, context) => embeddings(request, context.state, context.options?.embeddingDimensionsByModel ?? {}),
        },
    ],
    handle: (request) => ({ status: 404, body: errorBody(404, `Unknown request URL: ${request.method} ${request.pathname}`) }),
    controlActions: {
        reply: (body, context) => {
            if (typeof body !== "object" || body === null) throw new FakeControlRejected(400, "reply needs a ScriptedReply body")
            context.state.replies.push(body as ScriptedReply)
            return { queued: context.state.replies.length }
        },
        "set-models": (body, context) => {
            const models = (body as { models?: unknown } | null)?.models
            if (!Array.isArray(models)) throw new FakeControlRejected(400, "set-models needs { models: string[] }")
            context.state.models = models.map(String)
            return { models: context.state.models }
        },
        "set-embedding-dimensions": (body, context) => {
            const dimensions = (body as { dimensions?: unknown } | null)?.dimensions
            if (typeof dimensions !== "number" || !Number.isInteger(dimensions) || dimensions < 1) {
                throw new FakeControlRejected(400, "set-embedding-dimensions needs { dimensions: positive integer }")
            }
            context.state.dimensions = dimensions
            return { dimensions }
        },
        "chat-requests": (_body, context) => context.state.chat,
    },
    client: (bridge: FakeBridge, base: FakeClient): OpenAiCompatibleClient => ({
        ...base,
        reply: async (reply) => {
            await bridge.call("reply", reply)
        },
        setModels: async (models) => {
            await bridge.call("set-models", { models })
        },
        setEmbeddingDimensions: async (dimensions) => {
            await bridge.call("set-embedding-dimensions", { dimensions })
        },
        chatRequests: () => bridge.call<ReadonlyArray<OpenAiChatRequest>>("chat-requests"),
    }),
})
