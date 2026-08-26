# Global input analysis

Run this lightweight analysis before loading any `skills/<id>/SKILL.md`. It first binds an explicitly named project and role to one verified Source route, then selects the first required specialized capability from the user's natural-language request or a validated v6.1 handoff. The route vocabulary and authorities are defined once in `INDEX.md`.

## Allowed context

| Side | May inspect | Must not inspect yet |
| --- | --- | --- |
| Active input | Current user request, explicitly attached artifacts, declared project/role/scope, approval and constraint references | Unrequested historical conversations or inferred authority |
| Passive context | Skill `name` and `description` from `skills/catalog.json`; Source identity supplied by the host; the exact portable and hydrated route for a named project and role | Other workspace routes, skill bodies, operators, Qdrant knowledge, product source, generated coding context, or run artifacts |

This boundary keeps selection cheap. Route metadata may identify the target checkout, but source bodies, business, Grammar, coding-context and knowledge retrieval belong to the selected skill or its current operator.

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

1. Normalize the requested outcome, project, role, target, lifecycle phase, mutation intent and approval boundary from active input.
2. When project and role identify Git or source work, complete the route-first guard before skill selection.
3. Compare the normalized intent with only the catalog metadata. Apply every positive trigger and exclusion in each description.
4. Select exactly one skill. Every skill owns one fixed-entry capability. For work spanning several capabilities, select the earliest missing capability whose output is required by the next; later capabilities are selected from typed handoffs, never preloaded from a lifecycle-sized skill.
5. If no candidate matches, continue without a StarCi skill while preserving the verified route. If two candidates remain materially plausible, ask one focused clarification and do not load either skill yet.
6. For a handoff, validate its artifact hashes, next-candidate risk, authorization, transition kind, and optional resume capability. A sequential handoff advances the same objective; a side branch must declare where to resume.
7. Validate the selection with `analyze-input.schema.json`, keep it and any route resolution only in task-session memory, then load the selected `SKILL.md`.

## Capability routes

| Intent or prerequisite | First capability |
| --- | --- |
| Missing or stale operational stack | `starci-tech-stack` |
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

## Selection envelope

```json
{
  "analyzerVersion": 1,
  "skillId": "starci-frontend-ui-direction",
  "confidence": "exact",
  "activeInputRefs": ["request:current"],
  "passiveContextRefs": ["skills/catalog.json"]
}
```

- `exact`: prompt intent maps to one catalog entry without clarification.
- `clarified`: the user answered the one ambiguity that prevented a unique match.
- Refs identify task-session evidence; they do not copy payloads or authorize persistence.

The selected skill must reject an envelope whose `skillId` does not match its local schema. Purge the envelope and all other intermediate task-session data at every terminal state.
