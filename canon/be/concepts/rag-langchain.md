# RAG and LangChain

Source: `src/modules/langchain/` (model and embedding wrappers), `src/modules/rag/` (the
retrieval-augmented use cases), `src/modules/databases/qdrant/` (the vector store behind them).

A real model call goes through the balancer and entitlement layer —
[ai-catalog-balancer-entitlement](ai-catalog-balancer-entitlement.md). RAG is the **business layer**
sitting on top of that, not a parallel route to the providers.

## The LangChain wrappers

`langchain.service.ts`, `model.service.ts` and `embedding-model.service.ts`, with providers supplied
by `@langchain/openai` (GPT), `@langchain/google-genai` (Gemini), `@langchain/qdrant` (the vector
adapter) and `@langchain/community`.

## The RAG use cases are concrete

`src/modules/rag/` is a list of real features, not an abstraction:

- `content-rag-index.service.ts` / `content-rag-retrieval.service.ts` — indexing and querying course
  content.
- `cv-rag-index.service.ts` / `cv-rag-retrieval.service.ts` — CV review.
- `grading-rag-retrieval.service.ts` — grading with context.
- `github-repo-import.service.ts` — pulling a repository in as a RAG source.

## The public playground

`public-rag-playground.service.ts`, `public-rag-playground-cleanup.service.ts` and
`rag-playground-run-registry.service.ts` form a demo sandbox: a cleanup job clears out old runs and
the registry tracks the ones still running. Its socket namespace is
`src/features/socketio/core/rag-playground/` — see [realtime-socketio](realtime-socketio.md).

## Streaming, not blocking

An LLM response is streamed through `@modules/stream-async-iterator`, wrapped into SSE or socket
chunks. The request is never held open waiting for a full completion.

## Where the vectors live

Embeddings are stored in Qdrant (`databases/qdrant/`) — not in Postgres. Postgres holds the source
rows; the vector store is a separate backing store, and the two are synchronised rather than shared.
