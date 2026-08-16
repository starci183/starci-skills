# Design canon module template

Template id: `design-canon-v2`

Design canon contains framework-light UI laws. It maps visible intent and relationships to ordinary
semantic `className` patterns. It must not depend on a product component registry.

## Module records

Every module has exactly six records and one shared version:

| Record | Job |
|---|---|
| `INDEX.md` | Concise machine-first law |
| `prompt.md` | Reusable reasoning prompt and ambiguity handling |
| `vi.md` | Vietnamese guide for humans |
| `example.md` | Generic TSX/className examples |
| `audit.md` | Adversarial review, ambiguity and remaining limits |
| `changelog.md` | Append-only version history |

## Universal constraints

- Use semantic classes such as `text-foreground`, `gap-2`, `p-4`, `mx-auto`.
- Share one surface vocabulary: `bg-background`, `bg-card`, `bg-muted`, `border-border`,
  `ring-ring`, `text-foreground`, and `text-muted-foreground`.
- Do not require StarCi, a named product component, a route, or a private contract.
- Do not expose `INSUFFICIENT CONTEXT` as a canon result.
- Prefer a safe default when the law has one.
- When no safe default exists, `prompt.md` asks exactly one concrete missing question.
- Keep review process in `audit.md`; do not add a Review Checklist to public guides.
- Separate meaning from implementation: tokens may vary, but the semantic relationship remains.

## INDEX.md

Use this order:

```markdown
## Law
## Inputs
## Decision Table
## Invariants
## Exceptions
## Output
## Load Policy
## Version Rule
```

`Decision Table` returns semantic classes or a short class pattern. `Output` defines the compact
answer an AI emits: decision, className, reason, and optional one-question clarification.

## prompt.md

Use this order:

```markdown
## Prompt
## Decision Procedure
## Worked Requests
## Ambiguity Tests
```

The prompt accepts plain UI requirements. It must never invent a product component. Ambiguity tests
show the safe default or the single missing fact to ask for.

## vi.md

Use this order:

```markdown
# vi.md

> Version: ...

# <Tên canon>

<Một câu định nghĩa.>

## Bảng quyết định
## Luật
## Ví dụ
## Ngoại lệ
```

The decision table uses `Tình huống | className | Vì sao`. Examples use ordinary TSX and include
both correct and incorrect choices where the boundary matters.

## example.md

Use this order:

```markdown
## Example Index
## Cases
## Boundary Matrix
```

Each case states the situation, className, why, and not-when. Examples remain generic even when the
preview uses a real component library.

## audit.md

Use this order:

```markdown
## Verdict
## Ambiguity Tests
## Findings
## Decisions
## Re-audit Triggers
```

Audit asks whether two readers can derive the same semantic class from the same request. It records
uncertainty here instead of leaking a pseudo-result into public canon.

## changelog.md

Use this order:

```markdown
## Version Policy
## <current version>
## <older version>
```

## Migration rule

A design module opts in with `template: design-canon-v2` in `INDEX.md`. Once opted in, the
validator requires all six records, rejects product-specific vocabulary in normative records, and
rejects the literal safe-stop token from the entire module.
