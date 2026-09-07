# Work 3.0 runtime guide

Local alpha. The executable surface is a validator and inspection CLI plus bounded agent operation contracts; it is not a scheduler, browser adapter, secret manager or deployment service.

For each prompt the entry selects named presets/modes from [skills/catalog.json](../skills/catalog.json) against `.work` scope. Follow their fixed recipes; never invent a workflow. Across every selected skill, retry and worker: max three sequential waves × three concurrent invocations (nine total), no reset. Execute only the request-bounded portion, verify prerequisites and hand off what remains. This is an agent contract, not a CLI engine; already-authorized steps need no repeated approval.

## Current authority

- [Operator catalogue](ops/catalog.json): select one ID and read its exact document plus commonDocument. [Vietnamese guide](README.vi.md) is a human mirror.
- [Core](core/README.md) and `schemas/`: machine fields, digests, supported completion profiles and verification limits.
- Product `.work/workspace.yaml`: one stable workspace identity; `.work/<business>/**/node.md`: filesystem completion tree.
- Product `.work/_resources/<category>/<slug>/resource.yaml`: shared repository, environment, identity, fixture, contract/design/artifact-storage references.
- Node/flow `evidence/<id>/manifest.yaml` and assets: observations bound to the source actually checked.

Paths outside `.work` are bound through resource IDs. Do not duplicate code, API schemas, credentials or service configuration into the ledger when their canonical owner already exists. Browser/session storage and decrypted secrets do not belong in tracked resources or artifacts.

## Metadata format

This alpha accepts JSON syntax in `workspace.yaml`, `resource.yaml`, `manifest.yaml` and the `---` delimited front matter of `node.md`. JSON is a YAML-compatible subset; arbitrary YAML is intentionally unsupported and must be reported as invalid, never silently misread. Markdown below the front matter holds human-readable domain detail. This avoids a partial YAML parser or hidden runtime dependency. A later reader can add YAML support without changing IDs or folder ownership.

Minimal unfinished business leaf:

```markdown
---
{
  "schema": "work/node@1",
  "id": "sample.requirements",
  "kind": "business",
  "required": true,
  "state": "todo",
  "assertions": ["requirements-approved"]
}
---
# Requirements

## Scope
Describe the actors, functional behavior, non-functional constraints and explicit exclusions from actual user/source evidence.

## Done when
The requirements and measurable acceptance criteria are reviewed against their cited sources; unresolved choices remain visible.
```

This is a synthetic template, not an approved business or a completed operation. Use core schemas for completion/evidence fields; do not infer them from this todo example.

All node kinds use one format. Group nodes have child nodes and do not store state/completion. Use child leaves for work that needs its own owner, acceptance or evidence. Shared context belongs in ancestor scope and explicit refs; dependencies are IDs, not folder ordering.

## Commands

Run `node bin/starci-skills.mjs work ...` from the package checkout, or `node .claude/bin/starci-skills.mjs work ...` in a relocated installation:

| Command arguments after `work` | Effect |
| --- | --- |
| `init <new-work-root> --id <workspace-id>` | Create only a new minimal root; refuses an existing one. |
| `ops` | Read the operator catalogue. |
| `op <op-id>` | Display the exact contract, not execute it. |
| `validate <work-root>` | Read-only structural/binding/evidence validation; nonzero on invalid data. |
| `tree <work-root>` | Read-only derived completion view, not an auto-run queue. |
| `impact <work-root> <node-or-resource-id>` | Read-only dependency impact inspection, not authorization to rerun affected nodes. |
| `audit-legacy <legacy-root>` | Read-only file inventory; no verdict import, script execution or secret resolution. |

There is no CLI `cook`, `approve`, `done`, `spawn`, `retry`, `deploy` or `migrate` command. The agent uses existing tools within the selected op and user's authority; the CLI does not turn content into execution. Author files with the environment's permitted editing tool, verify, then commit scoped changes.

## Completion and evidence

Stored leaf states are todo/doing/blocked/done/na/suspended. Authored `suspended` requires a nonempty `suspensionReason`, useful for source imports whose intent/acceptance remains unverified; never fabricate old completion. Separately, completed work becomes effectively suspended when semantic inputs change or a prerequisite loses done. Preserve old completion/evidence; never rewrite digests to pretend re-verification. Fail/not-run/inconclusive are outcomes, not passes; optional/deferred obligations stay visible.

Keep one evidence bundle for a run proving several assertions and refer to it; do not duplicate screenshots into each leaf. Retain exact required assertion IDs, original observed outcome, source/integrated code refs, actual served build identity, environment/account/fixture refs and asset hashes. Requirement expected behavior must not be rewritten to match a failing observed behavior.

Full SHA and repository ID establish a code reference; they do not prove the Git object remains available or that a server is running it. Image bytes establish a capture exists, not that it shows the asserted UI. Human review/tool observations remain necessary. Read core documentation for exactly what the local validator checks; unsupported external storage and unknown profiles are not automatically certified.

Track small sanitized evidence in Git or use durable external storage with owner, hashes, access controls and retention. This alpha does not fetch/verify arbitrary remote blobs or manage LFS/vault/provider lifecycles. No URL/token/credential-shaped content should be copied into proof without reviewing sensitivity; automated field/pattern checks are not comprehensive secret/PII detection.

## Scale and extension

### Scope owns the dependency graph

Declare relationships in the product's `.work`, not in operator dispatch rules:

- `dependsOn` lists node IDs that must be effectively done before this piece is eligible. A reasoned N/A is not proof that a prerequisite module/account exists.
- `refs` lists semantic node/resource inputs whose changes invalidate proof; it does not impose execution order.
- Reference design/art-direction resources explicitly. Optional resource `files:[{path}]` binds actual local source bytes under that resource directory, so replacing a declared design image changes consumer inputs even without a manual revision bump. Remote resources, code and served builds still require refresh from their canonical owner; the validator does not poll them.

For example, a business may declare `art direction -> UI design -> FE -> UI UAT`, while its BE branch has no dependency on art direction. Another may require `module -> account` and `module + account -> chat`. These are examples of user-approved scope, not universal built-in chains. Cross-business edges use the same stable IDs. Dependency/reference cycles and missing IDs are errors, not reasons for the agent to invent missing work.

Completed downstream consumers become suspended transitively when their bound inputs change. Unrelated nodes retain their completion. Before starting, inspect eligibility and impact; graph changes require an explicitly selected scope update. An execution op only reads that graph, performs its assigned work and records results. It does not remove blockers, select successors or automatically redo affected pieces.

A design-source image and a UAT screenshot have different roles. Changing a declared design input can suspend UI work. Editing an old screenshot invalidates that evidence's byte integrity; it is not authorization to change the design. No hash detects an unrecorded business decision or proves visual correctness.

Add business, mobile, security, accessibility, migration, release or operations branches with the same node format. Stable IDs survive folder moves. New kinds/extensions retain data but need a supported validation profile before verified completion can be claimed. Do not create another progress database or manual parent-status file. Indexes may be regenerated as local caches.

A shared resource has one canonical owner and version. Cross-business dependencies reuse IDs, not copied account/fixture files. Multiple host writers need external coordination or serialization; local files and Git merges alone do not provide a distributed resource lease. Explicitly approved parallel operations require disjoint write boundaries and mutable-data/browser isolation.

## Upgrade and legacy data

V2 alias/routing/workflows/scripts/contracts and Lite are removed. Historical recovery uses Git, not runtime fallback. Safety tests and migration inventory may name old paths to protect product ownership, not to restore the old storage contract. No old receipt automatically becomes a V3 done node.

Installer upgrades from older majors require `--upgrade-major`. Only unchanged manifest-owned retired runtime files are removed; modified/unowned files, product data and Git checkouts are preserved. Custom conflicts stop before writes; no-bootstrap cannot abandon an active Lite entry. Init on managed installs uses safe update semantics. This does not grant product migration authority.

Before a separately authorized migration: inventory tracked/untracked/ignored files and nested Git worktrees; preserve unique commits/evidence and secret custody; assign canonical owners; map one business and verify from a clean checkout; then cut over one writer. Never delete old checkouts or artifact folders simply because their names look temporary.

## Local verification

`npm test` runs V3 executable tests and relocated installer checks. Doctor quick checks installed core/ops/presets; full adds CLI/acceptance. No product server, account or real browser UAT is touched. Package correctness is not product acceptance. No legacy test command or executable fallback is shipped.
