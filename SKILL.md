---
name: starci
description: Select one bounded workflow, execute its complete operators, and prove the requested outcome.
---

Before every invocation, run `node scripts/ensure-build.mjs` from this skill's directory. It checks source and compiled JSON, immediately builds missing/stale `.dist`, and verifies the result. If it fails, stop; never use stale output. Do not assume a previous invocation's build is current.

For project work, read `.dist/schemas/workspace-routing.json`. Source owns this `.claude/` and sibling `.workspaces/`; resolve `.workspaces/projects/<project>/work.json` there and verify target repositories. The project's backend owns its durable `.work/`; FE shares that root. Preserve Source while changing directories. Never substitute an outputs example for the real project Work.

Read [.dist/workflows/catalog.json](.dist/workflows/catalog.json), select one workflow matching the requested outcome, then read only its definition and selected operator JSON from [.dist/ops/catalog.json](.dist/ops/catalog.json). Read [.dist/policy/common.json](.dist/policy/common.json) and the selected host profile. Load referenced knowledge JSON only when applicable; do not read the whole library.

Read [.dist/workflows/gates.json](.dist/workflows/gates.json) for every workflow. Questions can remain read-only. Unmatched work uses `direct-task` with the single `task.execute` op; it discovers actual context and requires `.work` before effects. Unknown explicit workflow IDs are errors. Bind actual targets and authority before effects, reusing existing user authorization.

A workflow has at most 3 sequential rows and 3 parallel primary cells per row. Each caller defines at most 3 secondary types in its own JSON. Follow its exact trigger and authority, wait for support, and verify its result inside the same cell. No recursive support, automatic new agents, or unrelated successor work.

The accepted output of one cell is the next cell's input unchanged. Advance only when request/response binding, all required criteria, and evidence pass. Repair within the existing cell and scope; never weaken criteria. Frontend has an executable local gate; the other matrices are declarations followed by the current coordinator, not a background dispatcher.

FE/BE implement owns appropriate lint, typecheck, tests, build, Sonar, and scoped local commits. FE consumes all draws, reuses or creates assets, and outputs UAT flows and asset status. Unavailable image generation permits explicitly deferred decorative slots only. UAT owns account/seed/resource scripts, sequential flows, UX yes/no, screenshots/video, and exact owned cleanup.

Preserve unrelated user content, evidence, credentials and worktrees. Report actual outcomes, checks, effects and remaining issues. Maintenance policy: [UPDATE.json](UPDATE.json).

Every workflow must first inspect the actual Work root. If missing, route to workspace-bootstrap, preserving the original request/scope and suspended target workflow. Bootstrap requires its own approved goal; after proof and acceptance, resume the original workflow. Invalid existing Work is never overwritten.

Before any operator effects, present a goal with final business behavior, service/caller ownership, exact repository paths, real current line ranges/anchors/source hashes for existing code, explicitly proposed new paths, non-code resource effects, each cell’s purpose, output schema, criteria and exclusions. Wait for an actual user message approving that goal. Inspection and proposal preparation may continue read-only. Never fabricate approval receipts. A changed goal invalidates its approval.

Each workflow may map request/response field names from exact approved inputs and accepted outputs, keeping scope and business meaning unchanged. Use workflows/lifecycle.mjs to validate goals, enforce Work/approval gates, issue typed cell requests and verify responses. The frontend runtime is an evidence subgate, not authority to bypass the lifecycle.

After technical pass, present the actual result and wait for user acceptance bound to that result. Only then mark the selected Work leaves done with current valid evidence; parent state derives from required children. Track goal, requests/responses and user decisions locally via saveRun under .work/_workflows/<run-id>/. These records do not count as business nodes or completion proof. Local receipts establish binding, not human authentication; the coordinator must source them from genuine user messages.

Work uses YAML 1.2: workspace.yaml, index.yaml, resource.yaml and evidence/manifest.yaml. New Work includes YAML schemas in _schema/. Legacy node.md is read compatibility only; never create both formats in one directory.

Business owns the checklist: stable child nodes identify independently checkable items, and assertions define each item’s acceptance. Multiple workflows may contribute evidence to the same item via workTargets. Reuse those IDs; never duplicate business items per run. Store local run directories only under .work/_workflows/. A workflow passing is not business completion: only full current evidence for every item assertion plus user acceptance permits done. Preserve contributions from other workflows.

Read .dist/schemas/work-layout.json when creating or extending Work. index.yaml is the folder’s node. Split business requirements, architecture, BE, FE and UAT into their own nodes when applicable; any node can grow child nodes. Assets belong under the owning node assets/. Use node.assets for semantic inputs and evidence assets with scope: node for captured output proof. _workflows is local-only and must remain ignored by Git and core completion/digests. Preserve IDs and existing evidence when expanding or refactoring.
