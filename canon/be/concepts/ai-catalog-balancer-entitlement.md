# Concept — AI catalog, balancer and entitlement

Source: `src/modules/ai/`.

Three layers sit here: the model catalog and its balancer, quota and entitlement over a single
credit pool, and the routers that pick a model per task. The generation and embedding calls
themselves run through LangChain — see [`rag-langchain.md`](rag-langchain.md).

## Catalog and balancer — `ai/balancer/`

`AiModelCatalogService` holds the model list per tier and `AiBalancerService` chooses and rotates
between them. `KeyRotatorService` and `KeyStoreService` cycle several API keys per provider, which is
what keeps one key from absorbing the whole rate limit; `UseApiService` makes the real call.
`ModelTier` (Premium, Standard, Cheap) is the axis along which entitlement selects a model.

## Entitlement — one shared credit pool

`ai-entitlement.service.ts`, with `types/ai-entitlement.ts` and
`constants/ai-entitlement.constants.ts`. Quota is a **single shared pool of credits**, deliberately
not split per feature. Each call subtracts according to `credit-cost.ts`, which prices differently by
model and tier. `AiInvokeService` is the common gate: it measures credit before it invokes.

## Routers, one per domain

`grade-model-router.service.ts` for grading a submission, `grading-lane-validation.service.ts` for
validating the grading lane, and `ai-task-model.service.ts` for choosing a model by task type. Each
extends `classes/abstract-model-router.ts`.

## Ping and health — `ai/ping/`

`gemini-ping.service.ts`, `openai-ping.service.ts` and `openrouter-ping.service.ts` are per-provider
health checks with latency, alongside `ai-model-latency.service.ts`. The balancer reads them so it
can route around a provider that is down or slow rather than discovering it mid-request.

## The breaking surface

`myAiQuota` is the GraphQL query that exposes entitlement. Changing the shape in
`types/ai-entitlement.ts` changes what the front end receives, so check the FE counterpart in the
same change rather than after it.
