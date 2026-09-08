# Error

This file answers one question: given a failure in the frontend, how is it represented and where
does it go?

Sources: `src/components/blocks/**/component.tsx`, `blocks/commerce/CartBlock/index.spec.tsx`,
`src/modules/toast/api.ts`, `src/modules/api/graphql/types.ts`, `src/hooks/swr/*`,
`packages/grammar/src/common/conformance.ts`.

## FE-ERROR-1 — Failure is a state of the pure half

| Case | When | Write |
| --- | --- | --- |
| Case 1 | The generic case | `"failed"` is a member of the block state union in 219 `component.tsx` files; the connected half maps SWR `error` to it and the pure half draws it |
| Case 2 | Several failure origins | `"sessionsFailed" \| "historyFailed" \| "streamFailed" \| "quotaRejected"` in `StarCiAiChatState`; `const stateNeedsRetry = (state) => state === "sessionsFailed" \|\| state === "historyFailed" \|\| state === "streamFailed" \|\| state === "quotaRejected"` |
| Case 3 | Failure copy | resolved by the connected half into `labels.states[props.state]` and drawn as an assistant turn: `{ id: \`state-${props.state}\`, role: "assistant", body: labels.states[props.state] }` |
| Case 4 | Retry | an action on `on`: `<Button variant="primary" size="sm" onPress={props.on?.retry}>{labels.retry}</Button>` |
| Case 5 | Connected spec | asserts the mapping: `mocks.cart.isLoading = true … expect(mocks.input?.blockState).toBe("pending")` |

## FE-ERROR-2 — The GraphQL envelope

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Every response | `{ success, message, error, data }` selected in each document (`query Course … { success message error data { … } }`) and typed `GraphQLResponse<T>` in `modules/api/graphql/types.ts` |
| Case 2 | A read hook unwraps | `return result.data?.course?.data ?? null` — a missing payload becomes `null` data, not a throw |
| Case 3 | A write with feedback | `runGraphQLWithToast(action, options): Promise<boolean>` — "Execute one GraphQL write and surface both transport and typed-envelope failures" |
| Case 4 | Localised default copy | `const DEFAULT_MESSAGES: ToastMessages = { successTitle: "Success", errorTitle: "Error", unauthorizedTitle: "Unauthorized", … }` overridable per call through `messages` |

## FE-ERROR-3 — `throw new Error` where silence would be wrong

52 `throw new Error(…)` sites exist in `src/` (non-spec). They mark a result that the code cannot
continue without.

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Empty payload on a required read | `if (value === undefined) throw new Error("Course Community returned no data")` |
| Case 2 | Mutation returned nothing | `if (result === null) throw new Error("Flashcard review completion returned no result")` |
| Case 3 | Slot used outside its owner | `if (value === undefined) throw new Error("CourseFoundationCategoryBlock slots must be rendered inside CourseFoundationCategoryBlockBase")` |
| Case 4 | Offline | `throw new Error("offline")` inside a fetcher so SWR records `error` |
| Case 5 | Custom class | one exists: `class PersonalProjectEnrollmentDeniedError extends Error` in `useQueryPersonalProjectTaskWorkspaceSwr.ts`; not a pattern |

## FE-ERROR-4 — Propagation

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Inside a hook | not caught; SWR stores it and the connected half reads `query.error` (`catch (` appears in 3 files across `src/`) |
| Case 2 | Inside a write action | `runGraphQLWithToast` returns `false` and toasts; the caller flips a local state (`payment.hasFailed`) |
| Case 3 | Render crash | `src/app/global-error.tsx` |
| Case 4 | Telemetry | `src/config/sentry.ts`, `src/instrumentation.ts`, `instrumentation-client.ts` |

## FE-ERROR-5 — Grammar package

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Invalid definition at module init | `throw new TypeError(\`Invalid ${definition.familyId} Grammar conformance: missing=[…], unknown=[…]\`)` in `defineGrammarRuleConformance` |
| Case 2 | Invalid vocabulary value | `assertPresentationState("unknown")` throws `TypeError` (`common/index.test.mjs`) |

## Open question

Whether a typed error class should replace `throw new Error("…")` for the "no data" cases: one
custom class against 52 plain throws, so the plain form is what the code does today.
