# Model functions

The runtime never hands a model the control loop. It calls the model the way it calls a function: a fixed
prompt frame, a required JSON form, a headless provider command, validation, and a bounded retry. The model
fills the form; the kernel decides what happens next. Everything procedural — which provider, how many
retries, how long to wait, who reports to whom, when to commit — is fixed by `execution/llm-functions.mjs`
and the supervisor, and is not reachable from the prompt.

There are four functions.

**`assessGoal({job, inputs, material, constraints, providers, cwd, runHeadless})`** reads a job once, together
with whatever it came with, and answers with one `starci/goal-plan@1`: a definition of done, a ledger of the
things that must exist (each `absent | partial | done | unknown` against the input it was read from), and as
many ops as the job needs. SRS/SDS is one input kind among bug reports, UAT flows, designs, datasets and
existing code; the ledger is derived from the definition of done, never from the repository's file structure.
Beyond the form, the plan must satisfy cross-field rules (`goalPlanRules`): unique op ids, a dependency graph
that is acyclic and closed over the plan's own ids, every ledger item referenced by an op unless it is already
done, and — because the kernel runs up to ten ops at once on one worktree — disjoint allowlists for any two
ops with no dependency between them. A broken rule is not an exception: the error names both offending ops and
goes back to the model as the next attempt's correction, so the model re-plans. `renderGoalMarkdown(plan, {job})`
turns the accepted plan into the deterministic one-pager the user approves, and `extractMaterial(files, {cwd, maxChars})`
prepares the material payload: each readable file relative to `cwd`, missing files skipped, the total capped and
marked `truncated`.

**`planOp({node, workflow, ownership, sdsMaterial, priorReports, ...})`** fills the input form of one operation
node — goal, allowlist, references, checks, acceptance, outputs — from the material and the reports that came
before it. The supervisor, not the model, then enforces that the allowlist stays inside the node's ownership.

**`decide({situation, options, context, ...})`** is the escape hatch for a crisis the policy table could not
settle. The options are a closed set supplied by the kernel, and the form's `option` is enumerated over exactly
that set, so the model can choose but cannot invent a move.

**`validateOp({op, node, diff, checks, references, memory, providers, skip, ...})`** is the one validator of a
workflow, called by the kernel per accepted op result after its own machine verification and before the
commit. It answers `starci/op-validation@1`: `accept`, or `reject` with findings that each name a file of the
diff; a finding elsewhere is dropped, a reject without a finding is an invalid form, and a reject made only of
dropped findings is `unavailable`, as is garbage or a closed provider chain. The `memory` is the page the kernel
maintains from earlier verdicts and the job rulings, so the same identity judges every op. Default providers
are `gpt-5.6-sol` then `claude-opus`; `skip` names the ones the allocator has parked. What the kernel does with
the verdict is in [workflow-kernel.md](workflow-kernel.md#validator).

## Providers

`HEADLESS_PROVIDERS` holds the command and the answer extractor for each target: `claude-opus` and
`claude-fable-5.1` (Claude's JSON envelope), `qwen3.8-flash` (Qwen's event list), and `gpt-5.6-sol`
(`codex exec --json`, whose JSONL stream is reduced to the last assistant message by `extractCodex`).
`callFunction` walks the provider chain in order and retries once per provider on an invalid answer. A
provider that refuses with a quota signal — `429`, rate limit, too many requests, overloaded — is different:
`runHeadless` raises a `rate-limited:` error, the attempt is recorded as `['rate-limited']`, and the chain moves
to the next provider immediately instead of spending a retry on a door that is closed.

## The rule

The model fills forms, the kernel decides. A function that returns prose instead of a form has failed; a plan
that would have the model choose the process has been mis-specified. If a new decision is needed, it becomes a
new form with a named schema — never a free-text instruction to the model.
