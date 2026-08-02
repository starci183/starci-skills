# Patch prompt — set up the 3-kind backend test architecture

Paste this whole block into a Claude Code session running inside a NestJS backend (Nivo, Mia Mia, or
any other) to give it the same testing setup as the StarCi reference. It is self-contained; the session
does not need the StarCi repo.

---

You are adding the StarCi three-kind backend test architecture to THIS NestJS project. Adapt every
step to how this project is actually built — discover its structure first, do not assume names.

## Before you start
- Read this project's Jest config, its `AppModule`, its env/config module, and find **every LLM / AI
  provider it injects** — an OpenAI client, an OpenRouter client, any other paid model API. Grep for
  `openai`, `openrouter`, `OPENAI_API_KEY`, `OPENROUTER`, model-client class names.
- Confirm the stack (NestJS + TypeORM + Postgres is assumed; adjust the container and the ORM steps if
  a dependency differs).

## Kind 1 — unit (Jest, isolated)
- A Jest **unit** project; `.spec.ts` co-located with the file it tests.
- The unit under test is isolated and its dependencies are mocked:
  `Test.createTestingModule({...}).overrideProvider(Dep).useValue(mock)`.
- Test the logic, the branches, the thrown exceptions — not the framework. No real I/O; fast.
- Script: `"test:unit": "jest --selectProjects unit"`.

## Kind 2 — e2e (Testcontainers)
- A separate Jest e2e config, e.g. `test/e2e/jest-e2e.json`.
- Add `@testcontainers/postgresql` (plus a container for any other real dependency the flow needs). In
  a global setup: start a real Postgres container, run the migrations, boot the **real** Nest app
  against it; teardown stops the container. Nothing is mocked.
- Tests exercise real endpoints / resolvers / webhooks end to end (`*.e2e-spec.ts`).
- Script: `"test:e2e:docker": "jest --config test/e2e/jest-e2e.json --runInBand"`.

## Kind 3 — harness (AI features on Claude Code OAuth)  ← the point of this patch
AI features (grading, RAG, generation) have no fixed expected output, so a normal assertion cannot test
them. The harness does two things:

1. **Override every paid LLM provider with Claude on Claude Code OAuth.** In the testing module, replace
   the OpenAI client, the OpenRouter client, and any other paid model client with a single Claude client
   authenticated by **Claude Code OAuth** — the token available inside a Claude Code environment, injected
   in code, so the AI runs **without any production provider key and at no cost**:
   ```ts
   Test.createTestingModule({ imports: [AppModule] })
     .overrideProvider(OpenAiClient).useValue(claudeClient)
     .overrideProvider(OpenRouterClient).useValue(claudeClient)
     // ...every other paid model provider
     .compile()
   ```
2. **Grade the output with a Claude judge.** Write a `judge(rubric, output)` helper that calls the
   Anthropic SDK with a structured-output schema and returns `{ pass: boolean, score: number, reasons:
   string[] }`; the test asserts `pass` and a score threshold. This tests non-deterministic AI output
   against a rubric instead of an exact value.
- Files: `test/harness/*.harness-spec.ts`, `test/harness/judge.ts`, its own `jest-harness.json`.
- Script: `"harness": "jest --config test/harness/jest-harness.json --runInBand"`.

## Verify
Run each of the three, fix until green, and report which now exist and pass. **Do not fake a pass** —
if the harness cannot reach Claude Code OAuth here, say so rather than stubbing the judge to always pass.

## Reference (authoritative)
The full rule, grounded in the reference implementation, is at
`canon/be/enforce/authoring/testing.md` in github.com/starci183/starci-claude-skills — or, once Pages
is live, https://starci183.github.io/starci-claude-skills/canon/be/enforce/authoring/testing . The block
above is self-contained if you cannot reach it.
