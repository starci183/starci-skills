# Model functions

The runtime never hands a model the control loop. It calls the model the way it calls a function: a fixed
prompt frame, a required JSON form, a headless provider command, validation, and a bounded retry. The model
fills the form; the kernel decides what happens next. Everything procedural — which provider, how many
retries, how long to wait, who reports to whom, when to commit — is fixed by `models/functions.mjs`
and the supervisor, and is not reachable from the prompt.

There are five functions, in `models/functions.mjs`.

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

**`critiqueGoal({job, scope, ledger, decisions, records, material, brand, constraints, providers, cwd, runHeadless})`**
is the objection to the goal itself, and it is mandatory: no goal reaches the approval page without it. It reads
the job text, the ledger items, the **decided** business and architecture records in scope with the statements and
acceptance criteria of their `srs`/`sds` payload (`boundRecords`: 40 records, 12k characters of statements), the
brand when there is one, and what the kernel can and cannot verify — checks, gates and the validator on one side,
taste and market on the other. It answers `starci/goal-critique@1`: one closed verdict (`sound`, `revise`,
`refuse`), objections typed `premise | scope | testability | hidden-decision | consistency` that each name their
evidence, the `required` changes, the `alternatives`, and the one `question` a refusal hangs on. An objection
without evidence is dropped and said so in the result; a `revise` or `refuse` with nothing evidenced to act on,
a `revise` with no required change, or a `refuse` with no question is an invalid form and goes back to the model.
Beside the verdict it answers **`overlaps`**: one entry per decided record the goal touches, as
`{record, case, evidence}` over the two cases visible from the goal text and the decided records
(`OVERLAP_CASES = [reference, conflict]`). That is what turns a critique into a plan - a `conflict` is
rendered for the owner under `### Conflicts for the owner` and travels into the intake's contract, a
`reference` is the list of records the intake must cite. The third case of a reconciliation, `new`, is not an
overlap with anything and is deliberately not the critic's to name: the intake authors it under its own
feature and declares what it reads and what it hands on. Overlaps are read as leniently as objections - an
entry naming no record, or a case outside the two, is dropped and counted in the result's reasons - because
a goal that goes uncritiqued costs more than an overlap the kernel could not shape. A goal that would only be
added beside the decided records, naming none of them, is `revise` with the reconciliation in `required`.

It also names the `prerequisites` the goal rests on and the tree lacks (`srs | sds | brand | decision`, with the
feature and why), which the kernel plans as intake first. Default providers are the host's `critique.runtimes`,
`gpt-6-astra` then `claude-fable-5.1` (one call per goal, and Fable's week is the scarcer window); an exhausted chain is
`{ok:false, verdict:'unavailable'}`, exactly as `validateOp`'s is. What the kernel does with the verdict — the
`goal.md` section, the contract of every operation, and the refused approval — is in
[workflow-kernel.md](workflow-kernel.md#phases).

**`planOp({node, workflow, ownership, sdsMaterial, priorReports, ...})`** fills the input form of one operation
node — goal, allowlist, references, checks, acceptance, outputs — from the material and the reports that came
before it. The supervisor, not the model, then enforces that the allowlist stays inside the node's ownership.

**`decide({situation, options, context, ...})`** is the escape hatch for a crisis the policy table could not
settle. The options are a closed set supplied by the kernel, and the form's `option` is enumerated over exactly
that set, so the model can choose but cannot invent a move.

**`validateOp({op, node, diff, checks, references, brand, io, memory, providers, skip, ...})`** is the one
validator of a workflow, called by the kernel per accepted op result after its own machine verification and
before the commit. It answers `starci/op-validation@1`: `accept`, or `reject` with findings that each name a
file of the diff; a finding elsewhere is dropped, a reject without a finding is an invalid form, and a reject
made only of dropped findings is `unavailable`, as is garbage or a closed provider chain. The `memory` is the
page the kernel maintains from earlier verdicts and the job rulings, so the same identity judges every op.
Default providers are `gpt-5.6-sol` then `claude-opus`; `skip` names the ones the allocator has parked. What
the kernel does with the verdict is in [workflow-kernel.md](workflow-kernel.md#validator).

### What travels beside the diff

Three payloads are data rather than prose in the role line, and each carries the rules that make it binding.

**`io`** is the declaration of the kind being judged - `{reads, writes}` as record kinds, from
`ioPayload(kind)`. It travels with one added rule, `VALIDATOR_IO_RULE`: *a record cited outside `io.reads` or
written outside `io.writes` is a defect, whatever else the diff gets right.* It is the one validator rule
that can be stated over data rather than over judgement, and an operation with no declaration is judged
without either the payload or the rule rather than against a rule it was never given.

**`brand`** is the product's identity, trimmed to what a verdict can rest on (name, family, rev, colour
tokens, mascot and logo assets, the forbidden list, the imagery prompt rules), handed over for the kinds whose
declaration says they read it. Three rules make it binding: a candidate or a built surface using a colour,
font or icon outside the brand tokens and the installed grammar is a defect; an `interface.asset` result whose
slot files are missing, or whose artwork ignores the brand's mascot and logo references, is a defect; and a
`frontend.implement` result that substitutes its own image for a declared slot, or omits one, is a defect. A
tree with no brand record sends neither the payload nor the rules.

**The reconciliation and integration rules** are always in `VALIDATOR_RULES`, because they are about what a
report may claim rather than about what the tree happens to hold. The **intake** rule names what the kernel
has *already* checked mechanically - that the records exist, that a referenced one is decided, that each
conflict names an open decision record under this feature, and that no decided record was edited - and asks
the validator only for what a reader can judge: whether a `reference` row's cited record really covers the
claim, whether a record the table calls `new` restates a decided one in other words, and whether a `conflict`
row's decision states both sides, the consequences, the numbered options and one recommendation. A record of
another feature this operation edited, and a side of the feature the table leaves out, are defects. The
**integration** rule is that an external system is proven live or it is not proven: an `integration.verify`
result whose scenario fakes, stubs, mocks, records, replays or skips the declared provider, or reads the
credential from anywhere but the environment variable the declaration names, or prints, logs or commits a
secret value, is a defect - and an `e2e.verify` evidence whose `proof.fakes` omits a provider the diff fakes
is a defect too, because a faked outside system is allowed there but never unnamed. The **render** rules say
what a drawing is: the markup kept beside each candidate as `<candidate>.html` is what the candidate is
judged from, a capture with no markup beside it is a defect, and in that markup a list of entities wrapped in
a card surface is a defect, as is a dominant colour the brand does not declare or the brand's primary present
nowhere. An image-model painting, a script that paints boxes, a mockup-tool export, a screenshot of unstyled
markup or grey placeholder bars are each a defect; loading, empty and error states are described in the
record, never drawn, and a candidate per state is not required.

## Providers

`HEADLESS_PROVIDERS` holds the command and the answer extractor for each of the five targets the runtime
knows: `claude-opus` and `claude-fable-5.1` (`claude -p --output-format json --model ...`, read through
Claude's JSON envelope), `qwen3.8-flash` (`qwen --approval-mode yolo --output-format json`, read through
Qwen's event list), and `gpt-5.6-sol` and `gpt-6-astra` (`codex exec --json --model ...`, whose JSONL stream
is reduced to the last assistant message by `extractCodex`). Every entry also names a `usage` reader, so what
a call cost is recorded beside its verdict. A target with no entry here is a failed launch naming the missing
command line, never a substitute model.

`callFunction` walks the provider chain in order and retries once per provider on an invalid answer. A
provider that refuses with a quota signal — `429`, rate limit, too many requests, overloaded (`RATE_LIMITED`)
— is different: `runHeadless` raises a `rate-limited:` error, the attempt is recorded as `['rate-limited']`,
and the chain moves to the next provider immediately instead of spending a retry on a door that is closed.

## The rule

The model fills forms, the kernel decides. A function that returns prose instead of a form has failed; a plan
that would have the model choose the process has been mis-specified. If a new decision is needed, it becomes a
new form with a named schema — never a free-text instruction to the model.
