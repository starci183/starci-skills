/** The `@starci/test-world/fakes` entry: the fakes framework, the shared fakes and the contract types a repo-specific fake needs. */

export type {
    FailureSpec,
    FakeBridge,
    FakeClient,
    FakeDefinition,
    FakeInstance,
    FakeStartContext,
    RecordedRequest,
    WebhookDelivery,
} from "./framework/contracts"
export { createFakeBridge, createFakeHandles } from "./framework/bridge"
export { FakesHost } from "./framework/host"
export type { FakesHostStarted, StartedFake } from "./framework/host"
export { createBaseClient, defineHttpFake, matchPath } from "./framework/http-fake"
export type {
    FakeHttpReply,
    FakeHttpRequest,
    HttpFakeContext,
    HttpFakeControlAction,
    HttpFakeHandler,
    HttpFakeRoute,
    HttpFakeSpec,
} from "./framework/http-fake"
export { FailureQueue, FakeControlRejected, FakeTimers, RequestLog, runBaseControl } from "./framework/failures"
export type { BaseControlTargets, RecordingHandle } from "./framework/failures"
export { answerJson, deliverWebhook, headersOf, parseForm, parseJson, readBody } from "./framework/http-kit"
export type { WebhookRequest } from "./framework/http-kit"
export { parseMessage } from "./framework/mime"
export type { MailAttachment, ParsedMessage } from "./framework/mime"

export { smtpFake } from "./shared/smtp"
export type { SentMail, SmtpFakeClient } from "./shared/smtp"
export { embeddingVector, openaiCompatibleFake } from "./shared/openai-compatible"
export type {
    OpenAiChatRequest,
    OpenAiCompatibleClient,
    OpenAiCompatibleOptions,
    ScriptedReply,
    ScriptedToolCall,
} from "./shared/openai-compatible"

// --- payment fakes (agent B2 uncomments each line when its `index.ts` exists) ---
export * from "./shared/vnpay"
export * from "./shared/momo"
export * from "./shared/payos"
export * from "./shared/sepay"
