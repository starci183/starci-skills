# Global input analysis

Run this lightweight analysis before loading any `skills/<id>/SKILL.md`. It first binds an explicitly named project and role to one verified Source route, then selects one single-flow skill from the user's natural-language request. The route vocabulary and authorities are defined once in `INDEX.md`.

## Allowed context

| Side | May inspect | Must not inspect yet |
| --- | --- | --- |
| Active input | Current user request, explicitly attached artifacts, declared project/role/scope, approval and constraint references | Unrequested historical conversations or inferred authority |
| Passive context | Skill `name` and `description` from `skills/catalog.json`; Source identity supplied by the host; the exact portable and hydrated route for a named project and role | Other workspace routes, skill bodies, operators, Qdrant knowledge, product source, generated coding context, or run artifacts |

This boundary keeps selection cheap. Route metadata may identify the target checkout, but source bodies, business, Grammar, coding-context and knowledge retrieval belong to the selected skill or its current operator.

## Route-first guard

Apply this guard to every Git or source action, including an ad-hoc action for which no StarCi skill is selected:

1. If the request names or unambiguously implies both a project and role, read only `<Source>/.workspaces/projects/<project>/<role>.json`.
2. Validate that portable declaration, then read its matching hydrated route at `<Source>/.workspaces/local/routes/<project>/<role>/config.json`.
3. If the local route is absent or stale, run the declared workspace initialization/hydration flow before touching Git or product source.
4. Verify the resolved checkout's directory, origin and branch against the route. Use that checkout for the action.
5. Never substitute the Source root, current working directory, a similarly named sibling repository or a Git worktree merely because it is nearby.
6. If project, role or route identity remains ambiguous, stop and ask one focused clarification. Do not guess.

Keep route resolution ephemeral. It constrains the selected skill's project/scope or the no-skill action; it is not added to the skill-selection envelope and does not authorize source loading by itself.

## Selection procedure

1. Normalize the requested outcome, project, role, target, lifecycle phase, mutation intent and approval boundary from active input.
2. When project and role identify Git or source work, complete the route-first guard before skill selection.
3. Compare the normalized intent with only the catalog metadata. Apply every positive trigger and exclusion in each description.
4. Select exactly one skill. Every skill owns one fixed-entry mission, not one technical layer. A product mission may classify and deliver its required frontend, backend, data, shared-contract and proof work inside the same machine. Select a different skill only when the request starts a genuinely different mission (for example deployment, recovery or infrastructure reconciliation), never merely because execution crosses FE/BE boundaries.
5. If no candidate matches, continue without a StarCi skill while preserving the verified route. If two candidates remain materially plausible, ask one focused clarification and do not load either skill yet.
6. Validate the selection with `analyze-input.schema.json`, keep it and any route resolution only in task-session memory, then load the selected `SKILL.md`.

## Selection envelope

```json
{
  "analyzerVersion": 1,
  "skillId": "starci-frontend-layout-delivery",
  "confidence": "exact",
  "activeInputRefs": ["request:current"],
  "passiveContextRefs": ["skills/catalog.json"]
}
```

- `exact`: prompt intent maps to one catalog entry without clarification.
- `clarified`: the user answered the one ambiguity that prevented a unique match.
- Refs identify task-session evidence; they do not copy payloads or authorize persistence.

The selected skill must reject an envelope whose `skillId` does not match its local schema. Purge the envelope and all other intermediate task-session data at every terminal state.
