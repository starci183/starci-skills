# Backend pattern authority

## LOADS

None.

## Record

This is the stable v4 entry to backend source architecture. Detailed pattern laws remain in their one
homes under `compilers/patterns/be/`; this shelf selects and binds them without copying a ruling.

## Routes

| Accepted shape contains | Authority |
|---|---|
| Any backend file, import, operation, persistence, event, failure, test or transport decision | the reached child under `compilers/patterns/be/<module>` |
| Complexity, semantic duplication, volatile outcome facts, repeated normalization, contradictory state or analysis provenance | `compilers/patterns/be/maintainability` |

## Required plan binding

Every backend plan emits one binding per reached module:

```json
{
  "module": "<pattern module>",
  "situations": ["<fixed situation code>"],
  "paths": ["<exact approved path>"],
  "evidence": ["<live schema or sibling fact>"]
}
```

## Rules

1. A planned file has at least one pattern binding.
2. Every binding names fixed situations, exact paths and live evidence.
3. A router adds no second ruling; the child pattern remains authority.
4. A backend fact with no pattern situation is a standards gap and stops planning.
5. An enforced situation must remain accountable through the rule-binding chain.

## Stops

- The route or sibling/schema evidence is stale.
- A file has no reached pattern situation.
- A situation has no exact path or evidence.
- The plan requires inventing a product-local architecture convention.

## Output

```text
module: <pattern authority>
situations: <fixed codes>
paths: <exact files>
evidence: <live facts>
```
