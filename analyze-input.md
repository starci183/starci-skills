# Global input analysis

Run this lightweight analysis before loading any `skills/<id>/SKILL.md`. Its only job is to select one single-flow skill from the user's natural-language request.

## Allowed context

| Side | May inspect | Must not inspect yet |
| --- | --- | --- |
| Active input | Current user request, explicitly attached artifacts, declared project/scope, approval and constraint references | Unrequested historical conversations or inferred authority |
| Passive context | Skill `name` and `description` from `skills/catalog.json`; Source identity already supplied by the host | Skill bodies, operators, Qdrant knowledge, product source, generated coding context, or run artifacts |

This boundary keeps selection cheap. Source, business, Grammar, coding-context and knowledge retrieval belong to the selected skill or its current operator.

## Selection procedure

1. Normalize the requested outcome, target, lifecycle phase, mutation intent and approval boundary from active input.
2. Compare that intent with only the catalog metadata. Apply every positive trigger and exclusion in each description.
3. Select exactly one skill. Every skill owns one fixed-entry flow; do not perform a second mode classification. For a request spanning several capabilities, select the first capability whose output is required by the next; later capabilities require a new selection after an explicit handoff.
4. If no candidate matches, continue without a StarCi skill. If two candidates remain materially plausible, ask one focused clarification and do not load either skill yet.
5. Validate the selection with `analyze-input.schema.json`, keep it only in task-session memory, then load the selected `SKILL.md`.

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
