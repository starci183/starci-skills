# tinkle-2 REPORT — modules/models/

## Delivered
`.claude/modules/models/` — pure YAML, no scripts, no README:

- `index.yaml` — coverage manifest: 5 allocator pools + 3 exception targets + a `notTargets` list (supervisor chains, non-operation model functions, HEADLESS_PROVIDERS) so an agent doesn't route them as operation pools.
- `selection.yaml` — declarative port of `.dist/kernel/model-policy.mjs`: ladders, workload normalization/derivation, all 16 qualification gates with verbatim reason strings, probation record gates + admission + dual budgets (2/scope, workflow ceiling `max(6, ops*6)`, kernel-function exemption), consume/refund semantics incl. the three valid refund proofs, providerFilter single-target probation rule, selectEligibleCandidate ordering, reviewerPolicy independence rules, fallback allowed/blocked reasons, and a `misuseModes` section. Every rule cites its mjs function; non-mjs facts cite runtimes.json/registry.json/capabilities.json.
- `profiles/` — 8 files, one per launch target:
  - Pools (runtimes.json): `claude-agent`, `claude-fable`, `codex-agent`, `qwen-agent`, `devin-agent`
  - Exception targets (registry.json only, off all automatic chains): `gpt-5.6-luna`, `qwen3.8-max`, `deepseek-v4-pro`
  - Each carries identity/capacity/launch facts plus `business:` {question, whenNeeded, whenNot, pickedBy, failureModes}; inference marked `INFERRED`, source tensions marked `OBSERVED`.

## Notable findings recorded in the yaml
- `qualifications.json` is empty — nothing is currently qualified; every admission is receipt- or probation-based. selection.yaml states this.
- `gpt-5.6-luna` is double-bound: a `targets` key AND a `targetAliases` entry → `codex-agent`. Flagged in its profile rather than resolved.
- `deepseek-v4-pro` profiles say "preferred" while costPolicy excludes it from automatic chains — recorded as observed tension, resolution stated.
- `claude-fable` has `requestedModel: null` (host-inherited on managed launch) but `headlessModel: claude-fable-5-1` — the documented split-identity case.
- `devin-agent` runs `devin models list` preflight because `auth status` passes while logged out (model-catalog.md).
- model-policy.mjs quirk kept verbatim in the port: probation `workloads` matching has NO `*` wildcard, unlike qualification evidence (probationReasons uses `.includes`, not the `.some(item=>item===kind||item==='*')` shape).

## Coverage check
`runtimes.json runtimes.*` = {codex-agent, claude-agent, claude-fable, qwen-agent, devin-agent} — all profiled.
`registry.json targets.*` = same 5 + {gpt-5.6-luna, qwen3.8-max, deepseek-v4-pro} — all profiled. 8/8.

## Gaps / not done
- `code-patterns.json` and `records.json` exist in `.dist/model/` but are not model-selection sources; records vocabulary is referenced indirectly via workload `kind`. Not profiled (out of lane scope).
- No yaml validation tooling run — files are hand-checked pure YAML; tinkle-5's sweep can gate syntax if a checker exists.
