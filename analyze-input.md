# Global input analysis

Run this lightweight analysis before loading any `skills/<id>/SKILL.md`. It first normalizes request
language through `request-vocabulary.md`, binds an explicitly named project and role to one verified
Source route, then selects the first required specialized capability from the user's natural-language
request or a validated v6.2 handoff. Workspace and route vocabulary and authorities are defined once
in `INDEX.md`.

## Allowed context

| Side | May inspect | Must not inspect yet |
| --- | --- | --- |
| Active input | Current user request, explicitly attached artifacts, declared project/role/scope, approval and constraint references | Unrequested historical conversations or inferred authority |
| Passive context | `request-vocabulary.md`; skill `name` and `description` from `skills/catalog.json`; Source identity supplied by the host; the exact portable and hydrated route for a named project and role | Other workspace routes, skill bodies, operators, Qdrant knowledge, product source, generated coding context, or run artifacts |

This boundary keeps selection cheap. Route metadata may identify the target checkout, but source bodies, business, Grammar, coding-context and knowledge retrieval belong to the selected skill or its current operator.

## Experience-feedback guard

Treat an explicit correction or blame from real product use as evidence that the active skill system missed a rule, branch, contract, or proof condition. During the same task, identify the narrow `.claude` owner of that miss, repair it, and add or strengthen a regression check; do not wait for a later release and do not broaden unrelated skills.

Persist a `.claude/requests/*.request.json` feedback ledger only when the correction concerns UX/UI behavior, visual composition, interaction semantics, or a reusable frontend design rule. For backend, architecture, routing, tooling, test, or execution-process corrections, repair the owning `.claude` contract and its tests without creating a frontend request. Product-source repair and skill-system repair remain separately scoped and separately proved.

## Route-first guard

Apply this guard to every Git or source action, including an ad-hoc action for which no StarCi skill is selected:

1. Bind `<Source>` to the host-provided Source identity that owns the single `.claude` runtime. Never rebind it to the current working directory, a routed checkout or a Git worktree.
2. Do not probe a routed checkout for `.claude/INDEX.md`. Its absence is expected and does not authorize a fallback Source, runtime copy or bootstrap repair.
3. If the request names or unambiguously implies both a project and role, read only `<Source>/.workspaces/projects/<project>/<role>.json`.
4. Validate that portable declaration, then read its matching hydrated route at `<Source>/.workspaces/local/routes/<project>/<role>/config.json`.
5. If the local route is absent or stale, run the declared workspace initialization/hydration flow before touching Git or product source.
6. Verify the resolved checkout's directory, origin and branch against the route. Use that checkout for the action.
7. Never substitute the Source root, current working directory, a similarly named sibling repository or a Git worktree merely because it is nearby.
8. If project, role or route identity remains ambiguous, stop and ask one focused clarification. Do not guess.

Keep route resolution ephemeral. It constrains the selected skill's project/scope or the no-skill action; it is not added to the skill-selection envelope and does not authorize source loading by itself.

## Selection procedure

1. Normalize the requested outcome, project, role, target, lifecycle phase, mutation intent, approval
   boundary and explicit execution mode from active input using `request-vocabulary.md`. Record the
   task-session-only `scopeUnit`, closed `targetSet`, applicable `surfaceRoles`, `exclusions`, material
   `ambiguities` and `interpretationEvidence`. A product `nhánh` is a related journey and surface family,
   not the current page; `toàn bộ` and `full` bind to the nearest named scope rather than the repository.
   `mode=bypass` selects bypass mode; absence of an explicit mode selects `gated`. Never infer bypass
   from urgency, prior approvals or a request to continue.
2. When two plausible language interpretations would materially change the project, role, product
   boundary, required surface set, mutation type, approval stage, external effect or completion criteria,
   stop and ask one focused clarification that states the competing interpretations. Do not ask when
   nearby nouns and actions resolve the meaning without changing scope.
3. When project and role identify Git or source work, complete the route-first guard before skill selection.
4. Compare the normalized intent with only the catalog metadata. Apply every positive trigger and exclusion in each description.
5. Select exactly one skill. Every skill owns one fixed-entry capability. For work spanning several capabilities, select the earliest missing capability whose output is required by the next; later capabilities are selected from typed handoffs, never preloaded from a lifecycle-sized skill.
6. If no candidate matches, continue without a StarCi skill while preserving the verified route. If two candidates remain materially plausible, ask one focused clarification and do not load either skill yet.
7. For a handoff, validate its artifact hashes, next-candidate risk, authorization, transition kind, and optional resume capability. A sequential handoff advances the same objective; a side branch must declare where to resume.
8. Validate the selection with `analyze-input.schema.json`, keep it and any route resolution only in task-session memory, then load the selected `SKILL.md`.

## Capability routes

| Intent or prerequisite | First capability |
| --- | --- |
| Missing or stale operational stack | `starci-tech-stack` |
| Pause active coding work in Git or resume its exact cross-device continuation | `starci-workflow-handoff` |
| New UI or substantial visual redesign | `starci-frontend-ui-direction` |
| Challenge a frontend proposal | `starci-frontend-design-critique` |
| Approved visual direction needs interaction behavior | `starci-frontend-ux-flow` |
| Approved flow needs implementation-level screen detail | `starci-frontend-ui-detail` |
| Approved detail needs component and Grammar contracts | `starci-frontend-contract-plan` |
| Approved frontend contract needs source changes | `starci-frontend-implementation` |
| Frontend implementation needs design comparison | `starci-frontend-visual-fidelity` |
| A fidelity-passed product needs journey proof | `starci-product-uat` |
| Current architecture is unknown or disputed | `starci-architecture-discover` |
| Persistence ownership is unknown or material | `starci-data-ownership-model` |
| Architecture needs alternatives | `starci-architecture-option-design` |
| Architecture proposal needs independent challenge | `starci-architecture-critique` |
| Approved architecture needs code/deployment binding | `starci-architecture-realization` |
| Backend behavior needs a solution | `starci-backend-solution-design` |
| Backend state changes need exact contracts | `starci-backend-contract-plan` |
| Backend contract needs independent challenge | `starci-backend-contract-critique` |
| Approved backend contract needs source changes | `starci-backend-implementation` |
| Backend delivery needs final semantic proof | `starci-backend-proof` |
| Commit requested, or lint/typecheck/Sonar requested as a standalone gate | `starci-static-quality-gates` |

## Selection envelope

```json
{
  "analyzerVersion": 1,
  "skillId": "starci-frontend-ui-direction",
  "confidence": "exact",
  "mode": "gated",
  "activeInputRefs": ["request:current"],
  "passiveContextRefs": ["file:request-vocabulary.md", "skills:catalog.json"]
}
```

- `exact`: prompt intent maps to one catalog entry without clarification.
- `clarified`: the user answered the one ambiguity that prevented a unique match.
- `gated`: every machine wait requires the displayed approval or rejection command.
- `bypass`: every machine wait binds its exact displayed revision to a task-session bypass-authorization receipt and follows only the declared approve target without pausing. It does not skip operators, validation, evidence, quality checks, write boundaries, safety checks or terminal blockers.
- Bypass is task-scoped. Do not carry it to a later invocation unless that active request explicitly selects it again.
- Refs identify task-session evidence; they do not copy payloads or authorize persistence.

The selected skill must reject an envelope whose `skillId` does not match its local schema. Purge the envelope and all other intermediate task-session data at every terminal state.
