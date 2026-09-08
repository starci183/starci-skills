# `interface.draw` recovery findings

## Scope and method

These tests exercise the compiled `.dist/operators/interface.draw.json` through
`scripts/validate_operator.py`. They also exercise `criteria.json` feedback instructions. During this
review the contract gained required `context.visual` and retained `generation-context`
bindings; the recovery fixtures cover that revised contract. They do not
invent a recovery runner, call ImageGen, launch Nivo, or mutate either Nivo repository.

The fixtures are sanitized from these source-owned Nivo requirements (SHA-256 at review
time):

| Source | Relevant requirement | SHA-256 |
| --- | --- | --- |
| `nivo-fe/apps/app/src/components/blocks/agentos/AgentOSModuleIntake/index.tsx` | A refusal remains visible after a failed start; submission carries pending state. | `659d3b0d76578a8bb1b713231720c4902363306ed6c8e018f0d131f841d2f175` |
| `nivo-fe/apps/app/src/components/blocks/agentos/AgentOSModuleIntake/component.tsx` | The goal action is disabled below three trimmed characters and keeps native input/action semantics. | `82fa5458734f3cdcaeae68d1cbe01cb12e4dfac55382784dd3ebd58feb8dbdbf` |
| `nivo-fe/apps/app/src/components/blocks/provisioning/AgentOSProvisioning/index.tsx` | The order/workspace journey has ordered phases, remembers the failed step, exposes live status, and carries AI-readiness retry pending state. | `c36b77035180bc9e2cf88cee2871c598ce893b79f941a66542011089a37cfad0` |
| `nivo-fe/apps/app/src/components/blocks/provisioning/AgentOSProvisioning/component.tsx` | Failure has negative presentation; status is polite-live; the retry action receives pending/disabled state. | `4a6b03b26b70e178085c92213e3c82458b26a2656e0ed2ee75d41279a973da41` |
| `nivo-fe/apps/app/src/components/blocks/agentos/AgentOSOpenClawLaunch/component.tsx` | Issuing, connected, blocked, expired, and disconnected are distinct; no URL, token, or credential-shaped value is accepted by the view. | `99db4c11b0f9752115fa37d01cbca89c064043eea1cec09fe256b8a1b87f5c23f` |
| `nivo-backend/src/features/core/api/core/graphql/mutations/agent-workspace/start-agentos-custom-module-intake/graphql-types/input.ts` | The backend validates a 3–4000 character goal and an idempotency key. | `81a04415737928da10a4a4d0b74d7090a6a6d99d39301a11e2bb1a37003b36b5` |
| `nivo-backend/src/features/core/api/core/graphql/mutations/agent-workspace/start-agentos-custom-module-intake/start-agentos-custom-module-intake.handler.ts` | Intake is owner-scoped, idempotent by key, preserves the trimmed goal, and opens a durable follow-up question. | `cde79ccdc2aed10b8f3a30901ff07d768f4e36ebe4261f37a3748d1e6782f851` |

## Enforcement boundary

| Concern | Current status | Evidence |
| --- | --- | --- |
| Request/response JSON shape | Machine-enforced | `validate()` runs both schemas before interpreting fields. |
| Exact request/work revision binding | Machine-enforced | `request-binding` compares `workId`, `workRevision`, `requestId`, and the work-root directory name. |
| Output identity and bytes | Machine-enforced | Duplicate output IDs, containment below `artifacts/<requestId>/`, existence, and SHA-256 mismatch fail. |
| PNG structural validity | Machine-enforced | Signature, chunk ordering, CRCs, header values, decoded data length, scanline filters, and terminal `IEND` are checked. This still proves structure rather than visual quality. |
| Visual baseline request | Machine-enforced | `extend`/`revise` require one image in `context.files` at `visual.baselinePath`; its bytes and digest are checked. |
| Retry generation binding | Machine-enforced | `generation-context` must bind the current request mode and exact baseline record, plus prompt/image records in one attempt directory. Replacing the selected baseline with a rejected prior candidate fails. |
| Preserve/change text in prompt | Machine-enforced for inheritance | `prompt-content` checks UTF-8/non-empty text and requires every declared preserve/change checklist item verbatim for `extend`/`revise`. |
| Brief fidelity and Nivo UI correctness | Review-required with a completion gate | Done requires all review results and request observations to pass. The validator checks their identity and output references; only actual inspection can establish semantic correctness. |
| Visual continuity | Review-required | Exact baseline metadata is checked, but whether the generator used it and whether pixels preserve the declared regions requires the returned `visual-continuity` review. |
| Invalid-but-schema-valid brief | Declarative runner requirement | `missing-essential-context` says to request correction, but no semantic brief check executes. |
| Feedback-round limit | Record-enforced | `feedbackRound` cannot exceed the compiled limit; at the limit a retry recommendation becomes stop. The caller must maintain truthful history. |
| Actual image-call count | Agent-owned | Attempt names are opaque. The caller tracks real calls and must not infer them from filenames. |
| Repeated-error stop rule | Declarative runner requirement | `stopWhen` is prose. `validate()` is stateless and gives the same result on every invocation. |
| Uncertain generation completion | Declarative runner requirement | The rule says to inspect status first, but no generation state or call ledger reaches the validator. |
| Attempt and response history | Declarative runner requirement | The latest response can pass with no prior response, no prior attempt, and no rationale linkage. |
| Updated output authority | Declarative runner requirement | The caller explicitly chooses the response file passed to the CLI, but there is no machine record that a corrected response supersedes one exact prior response. |

## Closed regressions

The adversarial cases exposed three concrete response-boundary false acceptances during
the review. Each now has a passing regression:

1. A header-only PNG was accepted as a completed direction; structural PNG validation now rejects it.
2. A `done` response could coexist with a failed review observation; the response schema now rejects it.
3. An inherited retry prompt could omit every preserve constraint; `prompt-content` now requires the literal preserve/change checklist.

The baseline substitution test also confirms that a rejected candidate from a prior
attempt cannot silently replace the exact request-selected baseline.

Separate green boundary tests demonstrate that declared recovery is not an executed state machine: an
`attempt-003` name is not a sound call count, and a single-record validator cannot prove
the existence or retention of earlier attempts and responses. A consumer
must not treat `machinePassed: true` as proof that recovery was attempted, bounded,
history-preserving, or visually accepted.

## Running the tests

From the repository root, with `jsonschema` available on `PYTHONPATH` or installed in the
active environment:

```text
python -m unittest discover -s .claude/operators/interface.draw/tests/recovery -p "test_*.py" -v
```

All thirteen focused tests pass. The tests dynamically discover the repository
root by locating `scripts/build-operators.py`; they contain no machine-specific dependency
path.
