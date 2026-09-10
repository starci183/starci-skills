# SDS as the target code map

SRS defines observable behavior, rules, journeys and acceptance. SDS maps those outcomes to the target code path: where a request or event enters, which files and symbols must run, which contracts and data boundaries are crossed, how failures and late results return to the app, and which checks will prove the path. Together SRS and SDS are the project's upstream source of truth. Implementation supplies the code and executed proof.

SDS prescribes the target even when files or symbols do not yet exist. It does not record observed/proposed source status, revisions or current-code evidence. Those facts belong to Implementation, which must map actual code back to SDS and report any gap instead of rewriting the design from code.

## Required tree

```text
.starciwork/features/<feature>/architecture/
├── index.yaml
├── overview/
│   └── index.yaml
└── sds/
    ├── index.yaml
    ├── flows/
    │   ├── index.yaml
    │   └── <flow>/index.yaml
    ├── code-map/
    │   ├── index.yaml
    │   ├── frontend/<code-unit>/index.yaml
    │   ├── backend/<code-unit>/index.yaml
    │   └── shared/<code-unit>/index.yaml
    ├── contracts/
    │   ├── index.yaml
    │   └── <api-event-job-or-call>/index.yaml
    ├── data/
    │   ├── index.yaml
    │   └── <model-or-store>/index.yaml
    ├── quality/
    │   ├── index.yaml
    │   ├── security/<concern>/index.yaml
    │   ├── performance/<concern>/index.yaml
    │   └── reliability/<concern>/index.yaml
    ├── deployment/
    │   ├── index.yaml
    │   └── <topology>/index.yaml
    ├── decisions/
    │   ├── index.yaml
    │   └── <decision>/index.yaml
    └── verification/
        ├── index.yaml
        └── <scenario>/index.yaml
```

Every folder owns `index.yaml`. Parents carry `starci/sds-aggregate@1` metadata and no authored state/completion. Detailed leaves use `extensions.work3.sds`:

| Folder | Schema |
| --- | --- |
| Flow | `starci/sds-flow@1` |
| Code unit | `starci/sds-code-unit@1` |
| Contract | `starci/sds-contract@1` |
| Data model/store | `starci/sds-data-model@1` |
| Quality concern | `starci/sds-quality@1` |
| Deployment topology | `starci/sds-deployment@1` |
| Design decision | `starci/sds-decision@1` |
| Verification scenario | `starci/sds-verification@1` |

The machine-readable contract is `specifications/sds-map.json`. Legacy source-independent `starci/specification@3` remains readable; new SDS authoring uses the code-map tree.

## Flow is the primary route

`flows/<flow>/index.yaml` traces the main, alternative and exception paths from SRS to an observable result. It contains:

- exact SRS requirement, flow, branch, NFR and acceptance references;
- app action, API, webhook, event, schedule or job entry point and receiving code-unit;
- preconditions, validated inputs and participating code units;
- ordered code steps with code-unit, operation, input/output, contract/data refs, transaction behavior and failure refs;
- alternative and exception sequences with fork step, condition, code steps, resume/end and outcome;
- recovery owner, durable state source, retry identity and safe resume condition;
- success/failure/cancelled/unknown postconditions as applicable;
- API/event/subscription response and the component/app state that displays immediate or late outcomes;
- selected deployment topology and verification scenarios.

A flow step must answer which file/class/function runs, who calls it, what it reads or writes, where authority is checked, when a transaction commits or rolls back, and what happens when the next boundary fails. Branch names without code steps are invalid.

## Code units and contracts

`code-map/{frontend,backend,shared}/<code-unit>/index.yaml` owns the prescribed repository role, target path, symbols and signatures, responsibility, callers/callees and contract/data/quality/verification references. It is an implementation contract, not a claim that the current file exists. One code unit may contain several tightly related symbols; do not create one folder per line or mirror the filesystem without design meaning.

Contracts state caller, receiver, sync/async/in-process mode, transport, operation, request, response, errors, authorization, timeout, retry, idempotency and compatibility. For async paths, identify producer, consumer, message identity, ordering and duplicate handling. An API path without its frontend caller or result mapping is incomplete when the user journey depends on that UI.

## Data and consistency

Each data leaf identifies the owning writer, authoritative or derived role, store, fields, states, transaction boundaries, consistency, retention and recovery. A flow links its actual reads/writes to these owners.

For a monolith, show module boundaries and in-process calls without inventing network concerns. For microservices, show service ownership, network/event contracts, independent failure, partial completion and reconciliation. Shared-database or cross-service writes require an explicit decision and consequence analysis.

## Security, latency and reliability

Quality leaves select only concerns relevant to the SRS and topology, but they must cover every material boundary:

- Security: principal, current resource/action/audience rights, credential boundary, input trust, disclosure on denial and abuse limits.
- Performance: measurement boundary, latency/capacity driver, candidate bottleneck, safe optimizations, cache consistency and cost/tradeoff.
- Reliability: timeout, retry, idempotency, duplicate/out-of-order events, concurrency, cancellation, partial effects, unknown results, recovery ownership and observability.

Do not invent business SLAs or retention. Keep unresolved targets linked to their SRS decision. An optimization is not accepted merely because it is faster; record what correctness, privacy, freshness, cost or operability it trades.

## Deployment, decisions and verification

Deployment maps code units and stores to the selected monolith or microservice topology, connections, configuration and credential custody, scaling, failure domains, rollout, rollback and recovery. Decisions compare at least one viable alternative and record status, rationale, tradeoffs, affected refs and revisit conditions.

Verification records the planned unit, integration, backend E2E, frontend or UAT scenario. It links Business acceptance to SDS scope and defines setup, actions, expected result, security/performance/failure checks and required evidence. A plan is not executed proof; Implementation and UAT attach current observations later.

## Chatbot code-path example

For `FR-CHAT-01`, one SDS flow can prescribe this path:

```text
ChatComposer.submit
  -> useAskQuestion.mutate
  -> POST /conversations/:id/messages
  -> ChatController.createMessage
  -> AskQuestionHandler.execute
  -> ConversationPolicy.assertMember
  -> ConversationRepository.beginRequest(requestId)
  -> KnowledgeRetriever.search
  -> LanguageModel.generate
  -> ConversationRepository.commitAnswer
  -> ConversationEvents.publish
  -> useConversationEvents / ChatStore.apply
  -> AnswerPanel renders answered | clarification | failed
```

Each arrow resolves to a `code-map` unit and, when it crosses a boundary, a contract. The flow records transaction behavior and the app-visible result at every significant branch:

- invalid input ends before a write and returns field feedback;
- denied access reveals no conversation content;
- insufficient context returns a clarification state that resumes the same request;
- a duplicate `requestId` reads the prior result instead of generating twice;
- retrieval or model timeout records a known failed or pending state, never a false answer;
- an accepted asynchronous request returns its ID, and a late event or refresh reconciles the same durable result;
- concurrent cancellation and completion use one authoritative state transition and expose the winner;
- partial event delivery is recovered from the stored request outcome.

In a monolith, controller, handler, policy and repository can be separate code units connected by in-process contracts; the network boundary may only be browser-to-backend and backend-to-model. In microservices, the same Business flow can map chat API, retrieval and generation to separate deployments with versioned API/event contracts, timeout budgets, idempotent consumers, outbox or equivalent delivery ownership, reconciliation and independent failure domains. The topology is a recorded choice; the SRS behavior and acceptance IDs remain the same.

Security quality leaves cover conversation authorization, prompt/input trust, tool permissions, secret boundaries, private-context filtering and abuse limits. Performance leaves allocate and measure browser, API, retrieval, model and delivery latency, then compare safe options such as bounded context, streaming, caching and async completion with their freshness, privacy, cost and complexity tradeoffs. Reliability leaves cover retries, duplicate/out-of-order events, unknown outcomes and recovery. Verification links those mechanisms back to positive, denied, timeout, duplicate, late-result and cancellation acceptance cases.

## Review and completion

Validate with `node bin/starci.mjs validate <work-root>`. A valid SDS map proves internal structure and traceability only. Readiness review still checks that significant SRS branches reach prescribed code and customer-visible outcomes, every contract/data writer has one owner, and material edge cases have mechanisms. Implementation separately proves which actual files and revisions conform.

Changing accepted SRS invalidates dependent SDS proof. Changing the code map requires affected implementation and UAT to be rechecked. Preserve unrelated completed scopes and historical evidence.
