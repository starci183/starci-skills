# Context for `content.generate`

## Purpose

Context is the exact material already available to build one educational unit. It answers "what may
this operator read?" before the brief is written. Context never expands mission scope and never turns
evidence into authority.

Every reference is immutable for the invocation and bound by a `sha256:` fingerprint. Source-backed
observations additionally bind the observed source head.

## Context classes

| Context | Role in the decision | Authority status |
| --- | --- | --- |
| Curriculum | The objective this unit serves, its place in the course, and the prerequisites the course already guarantees. | Required reusable law. |
| Style | Language, terminology, and editorial rules the editions obey. | Reusable law when bound. |
| Content source | The routed checkout and its head, including the unit being refactored. | Evidence that the work belongs to the frozen source. |
| AI runtime | The models, counts, and isolation the workspace configuration fixes for the brief and the critique. | Required. Decides who may write and who may judge. |
| Prior audit | Earlier reviews of the same unit. | Evidence and regression history. |

## Required context

Every invocation requires:

1. at least one curriculum reference;
2. the routed content source reference whose head equals `input.project.sourceHead`;
3. the AI runtime binding, fingerprinted against the workspace configuration.

Style and audit references are evidence and may be empty.

## Refs

| Alias | Resolves to | Bind | Required |
| --- | --- | --- | --- |
| `@external/minio/contents/<contentId>/<locale>` | `MinIO object contents/<contentId>/<locale>.json through the routed runtime` | fingerprint of the fetched object | Required: The lesson as served; the unit being authored or revised. |
| `@worktrees/sessions/central-runtime` | `<Source>/.worktrees/sessions/central-runtime/owner.json  (generation-<n>-ready.json and logs/ beside it)` | fingerprint + generation | Required: The AI runtime that runs, reads, and repairs generated code. |
| `@receipt/content-generation-receipt/<invocationId>` | `<@artifacts of invocation <invocationId>>/<receiptType>.json  (the receipt file that invocation registered in output.artifactRefs)` | fingerprint + the sourceHead the receipt binds | Optional: A prior audit of the same unit; regression history. |
| `@artifacts` | `input.project.artifactRootRef; convention <Source>/.worktrees/sessions/<invocationId>/artifacts/  (receipt, named artifacts, captures)` | fingerprint per artifact; every artifact written is registered in output.artifactRefs | Required: Where the brief, articles, code tracks, images, review, and receipt are written. |

## The runtime binding is a boundary, not a preference

`context.aiRuntime` reproduces what the workspace configuration already fixes: the teacher brief and
the final critique each run as exactly one fresh execution that inherits no turns, and the production
work runs on the writing model. These are constants in the contract, not tunable fields.

That is what makes the last step a review at all. A critique that inherits the producing conversation
has already agreed with it before reading anything, and a unit that passes its own author's review
has not been reviewed.

## What the brief owns

The teacher brief is written first and everything after it is measured against it. The brief publishes
the learning outcomes, the claims a visual may encode, the examples, and the add, change, and remove
dispositions. Nothing downstream may introduce an outcome or a claim the brief did not publish, so
context that would have belonged in the brief cannot be smuggled in during writing.

## Boundary

Context is read-only. The operator writes the brief, the editions, the image and its prompt, the
implementation tracks, and the critique under the declared targets, and runs only the declared build
and executable-check commands. It does not edit the curriculum, approve its own work, publish the
unit, or claim any readiness beyond the checks it actually ran.

## Resources

This operator runs end to end on the `luna` profile (`gpt-5.6-luna`, runtime `openai`), declared under `resources` in `operator.json` and validated by `scripts/validate-resources.mjs`. Grants it requires: web search, image generation, source write. It may search the web, bounded by the exact gap it must close and recorded, is not bound to Grammar, and must generate images to a stated claim. A grant absent from `requires` is unavailable even if the profile would permit it.
