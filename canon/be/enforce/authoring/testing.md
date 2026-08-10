# Testing (BE)

Scope: the three kinds of test this backend actually runs, what each proves, when to reach for
which, and the command that runs it. Grounded in `jest.config.ts`, the `package.json` scripts, and
`src/tests/{e2e,harness,stack}/**`.

---

## 1. Unit — `npm run test:unit` (`jest --selectProjects unit`)

Exercises one handler or service in isolation. Its dependencies — the entity manager, a cache
service, another provider — are replaced with jest-backed mocks through
`Test.createTestingModule({ providers: [...] })`, so the test proves the logic, the branches, and
the exceptions thrown, and never boots a database or a framework feature.

The `unit` project in `jest.config.ts` is `testMatch: ["**/*.spec.ts"]`, with `.int-spec.ts`,
`.e2e-spec.ts`, and `.harness-spec.ts` explicitly excluded from it — those three each have their
own config below. `npm test`, `test:unit`, `test:watch`, `test:cov`, and `test:ci` all select this
same project; this is the one that runs on every save and every CI push.

```ts
// src/modules/bussiness/user/user.service.spec.ts — both dependencies swapped for jest mocks
module = await Test.createTestingModule({
    providers: [
        UserService,
        {
            provide: CacheService,
            useValue: cacheService,
        },
        {
            provide: getEntityManagerToken(POSTGRESQL_PRIMARY),
            useValue: entityManager,
        },
    ],
}).compile()
```

The assertions in that same file read as branches, not wire shapes — `"cache hit short-circuits the
DB lookup"`, `"gates the rebuild query to PAID rows only"` — because nothing outside `UserService`
itself is real. Reach for this first: it is the only one of the three that costs nothing to run, so
it is where a branch, a thrown exception, or an edge case belongs by default.

---

## 2. e2e — Testcontainers — `npm run test:e2e:docker`

Boots the real Nest application against a real, disposable Postgres and drives real HTTP requests
at it — proving the wiring, not a mock of it.

`jest-e2e-docker.json`'s `globalSetup` (`src/tests/helpers/e2e-setup.ts`) constructs an
`E2eStackService` and calls `.up()`, which starts an actual `postgres:16-alpine` container via
`@testcontainers/postgresql` (`src/tests/helpers/e2e-stack.service.ts`) and points the
`POSTGRESQL_PRIMARY_*` env vars at it before any spec runs; `TypeORM synchronize: true` then builds
the schema fresh. `globalTeardown` (`teardown.ts`) stops the container after the suite. Each spec
then calls a helper like `createE2eApp` (`src/tests/helpers/create-e2e-app.ts`) to compile a
focused `Test.createTestingModule` around the real `PrimaryPostgreSQLModule`, the real `CqrsModule`,
and the real controllers under test — only the SDK clients for outbound payment gateways (SePay,
PayOS, Stripe) and the enroll-job queue are stubbed, because those are genuinely external to the
process.

```ts
// src/tests/e2e/sepay-webhook.e2e-spec.ts — a real HTTP request against the booted app,
// asserting a real row in the real (containerized) Postgres
await request(e2e.app.getHttpServer())
    .post(WEBHOOK_URL)
    .send({
        order_invoice_number: "INV-OK",
    })
    .expect(201)

const settled = await entityManager.findOne(TransactionEntity,
    {
        where: {
            id: transaction.id,
        },
    })
expect(settled?.status).toBe(TransactionStatus.Succeeded)
```

Files are named `*.e2e-spec.ts`, under `src/tests/e2e/`. Reach for this when the thing under
test IS the wiring — a webhook handler that has to commit a transaction row, an idempotency guard
against a re-delivered event, a query that is syntactically valid but wrong against the real
schema — because a unit test with a mocked `EntityManager` cannot catch any of those; it can only
prove the mock was called correctly. A disposable per-run container, not a shared dev database, is
the point: every run starts from an empty schema, so one run's leftover rows can never leak into the
next, and CI never needs a hand-maintained test database to go stale.

**Coverage is the whole business, not a sample.** Every business flow that commits state end to end
earns an e2e — every mutation that writes a row a user later sees (an enrolment, a challenge or
personal-project submission, a reward redemption, a payment settlement, a streak or XP grant, a
community post or reaction, a flashcard review), and every query whose correctness rests on the real
schema (a join, a projection read, a cursor page). A domain whose write flows carry no
`*.e2e-spec.ts` is a coverage gap, not a judgement call: money flows tested while enrol, submission,
progress, and community are not is exactly the hole this rule names. A flow whose only
non-deterministic step is an LLM call is still e2e-covered up to that call — the model is stubbed for
the e2e — and covered *at* the call by the harness (§3); it is never left untested in both. And an
e2e that cannot even boot (a provider missing from the test module, so `Test.createTestingModule`
never compiles) counts as absent, however green its assertions would have been: the lane is measured
by what runs, not by what was written.

**The lane runs SEQUENTIALLY — `--runInBand`, `maxWorkers: 1` — and that is not a tuning knob.**
Each jest worker's `globalSetup` boots its own Testcontainers Postgres; run the specs in parallel and
N workers spin up N containers at once, which exhausts the host and takes the machine down (a boot
that then fails its 120s health check under the load, not a real test failure). So `test:e2e:docker`
is `--runInBand` by design, and a fan-out that WRITES e2e specs must never also RUN them — ten agents
each booting a container is the same crash. The specs are written and type-checked in parallel; they
are validated in one sequential run afterwards.

(`npm run test:e2e` — `jest-e2e.json` / `setup-e2e.ts` — is the same idea wired the older way, its
own inline container boot rather than the shared `E2eStackService`. `test:e2e:docker` is the current
lane, built around the stack instance the harness lane below also shares.)

---

## 3. harness — AI features on Claude Code OAuth — `npm run harness`

For grading, RAG, and generation, there is no fixed string to assert against — the model does not
answer identically twice. `jest-harness.json` (`testRegex: "\\.harness-spec\\.ts$"`,
`testTimeout: 300000` — five minutes, because a real model call is not a mocked promise) exists to
make that testable anyway, by combining two things.

First, `src/tests/helpers/models.ts` holds one shared client, `client = new Anthropic()`, whose
own comment states its credentials are "resolved once, not per call" from "an env var or an
`ant auth login` profile" — Claude Code's own OAuth session, never a production `OPENAI_API_KEY` or
`OPENROUTER_API_KEY`. A harness spec overrides the app's real LLM entry point —
`AiInvokeService` (`src/modules/ai/ai-invoke.service.ts`, the single façade the app calls to reach
`ChatOpenAI`, `ChatGoogleGenerativeAI`, or `ChatAnthropic`) — with an adapter over this client, using
the same provider-swap `Test.createTestingModule({ providers: [{ provide: AiInvokeService, useValue: ... }] })`
already used to stub that same service in `src/tests/e2e/ai-lab-eval-runner.e2e-spec.ts`, except
here the stand-in is a real Claude call through Claude Code's own session rather than a canned
string. That override is why the lane is safe to run at all: no paid production provider key has to
exist on a test runner or in CI, and a suite that ran on every push cannot quietly rack up an OpenAI
bill nobody signed off on.

Second, once a real, non-deterministic generation exists, `src/tests/helpers/judge.ts` grades
it, because "did this satisfy the rubric" is exactly the kind of question a fixed-string assertion
cannot answer. `judge(rubric, output)` sends both to Opus 4.8 pinned at `effort: "high"` —
"regardless of which tier produced the output under test" per its own comment, so grading rigor
never varies with whichever `HARNESS_TIER` (`models.ts`: `economy` = Haiku 4.5, `medium`/`high` =
Sonnet 5 at low/high effort) generated the thing being judged — and gets back a structured verdict
via the SDK's JSON-schema-constrained output rather than free text to parse:

```ts
// src/tests/helpers/judge.ts
const res = await client.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    output_config: {
        effort: "high",
        format: jsonSchemaOutputFormat(VERDICT_SCHEMA),
    },
    messages: [
        {
            role: "user",
            content: `RUBRIC:\n${rubric}\n\nOUTPUT:\n${output}`,
        },
    ],
})

return res.parsed_output as Verdict
```

A harness spec then asserts `verdict.pass`, `verdict.score`, or a reason in `verdict.reasons` —
never the raw generated text — because the judge, not the spec, is the thing equipped to say
whether an answer that will never be byte-identical twice was still a good one.

The same shared `E2eStackService` Testcontainers Postgres backs this lane (`harness/setup.ts` and
`harness/teardown.ts` boot and stop it exactly as `test:e2e:docker`'s do), so a harness flow that
persists a grading run writes to a real, disposable database too, not a mock.

As of writing, no `*.harness-spec.ts` file exists in the tree yet — the lane itself (config,
setup/teardown, the shared client, the judge) is built and wired, waiting for the first AI feature
that needs it. Reach for this lane never for something with an expected value — that is unit or e2e
— only when the assertion has to be "was this good", not "was this equal".
