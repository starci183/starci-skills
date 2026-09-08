---
name: starci
description: Select one bounded workflow, execute its complete operators, and prove the requested outcome.
---

Before every invocation, run `node scripts/ensure-build.mjs` in this skill directory. Stop if the source and `.dist` build cannot be verified.

For project work, resolve the project binding from `.dist/schemas/workspace-routing.json`, then validate the backend-owned `.work` root. Canonical Work uses YAML `workspace.yaml` and `index.yaml` records only. It has no underscore directories or resource manifests. Current source provenance is direct. Workflow session YAML lives beside `.work` under `.starci-workflows`; Git retains history.

Before any effect, read `.dist/workflows/catalog.json`, select exactly one matching workflow, and announce its ID, why it matches, ordered operators, Work targets, and effect scope. Read that workflow, `.dist/workflows/gates.json`, `.dist/policy/common.json`, only its selected operator contracts, and the active host profile. An unknown explicit workflow is an error. Read-only questions need no workflow. Unmatched effectful work uses `direct-task`; it still requires a selected catalog entry and lifecycle-bound goal.

Use `workflows/lifecycle.mjs` for effectful workflow execution. A cell request requires a known selected workflow, valid Work, exact targets, an unchanged concrete goal, and actual user approval bound to that goal. Responses must preserve the request digest, typed outputs, criteria, evidence, and Work input bindings. No operator effect is requested outside this lifecycle.

When delegating a workflow cell, the child task prompt must explicitly invoke this project StarCi skill and carry the selected workflow ID, approved goal digest, exact cell ID/operator, Work root and targets, request digest, input bindings, output schema, criteria, and effect ceiling. Never send a free-form “implement this” prompt as a substitute for a workflow cell request. A support call remains inside its owning cell and authority contract.

Existing-business full-stack changes use two bounded workflows in order. First run `existing-work-design`: `business.decide` then `architecture.decide`. After its accepted outputs, run `fullstack-delivery`: `backend.implement`, then `interface.implement`, then `uat.verify`. Do not parallelize dependent business and architecture decisions. Use `frontend` when an approved UI direction must be drawn or revised before frontend delivery; never invent passing draws when no UI work is approved. Each workflow has at most three sequential rows and three parallel cells per row.

If `.work` is missing, suspend the selected workflow and run `workspace-bootstrap` with its own approved goal, then resume the original unchanged scope. Invalid Work is never overwritten. Inspect stale targets before effects with `starci-skills work stale <work-root>`; the runtime also rejects stale target execution.

Before requesting approval, prepare a concrete goal containing final behavior, service/caller ownership, exact repository paths, verified source hashes and line anchors for existing files, proposed new paths, resource effects, cell purposes, typed outputs, criteria, exclusions, and Work targets. Inspection may remain read-only. Never fabricate approval or acceptance receipts.

Canonical module ownership is `business/index.yaml`, `architecture/index.yaml`, `ui/index.yaml` with design PNGs under `ui/assets`, a thin derived `implementation/index.yaml` with separate `backend/index.yaml` and `frontend/index.yaml`, and `uat/index.yaml` with per-flow records and owned fixtures/captures. Frontend assets are screenshots of the running page; UAT screenshots and videos stay with their flow. Only leaves author `uninvestigate`, `todo`, or `done`. Semantic parent/dependency changes make affected completed work effectively `uninvestigate` without rewriting current completion evidence.

After every cell passes, present the actual result for user acceptance. Mark only selected leaves done with current digest-bound evidence after acceptance; parents derive progress. Report actual effects, checks, remaining gaps, and current Work state.
