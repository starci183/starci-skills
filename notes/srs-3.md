# srs-3: the Work layout and its checker

Branch `srs/3` owns `schemas/work-layout.yaml` and `checks/work-layout.mjs`. The per-record schemas
(`srs/1`) and the record checker (`srs/2`) are not written here. What follows is what this branch decided,
what it repaired, and the three questions the record schemas have to answer.

## What the layout says now

`schemas/work-layout.yaml` is rewritten to `starci/work-layout@4`, describing the tree that
`examples/todo-app/.starciwork` actually is. The previous `@3` described `features/<f>/business/srs/**`,
`extensions.work3` payloads and per-rule folders under a `business` tier; none of that exists on disk any
more, and the example is authoritative.

Ten families under a feature: `br fr nfr data journey decision sds ui impl uat`. One directory per record,
holding `index.yaml`. `ac/<name>/index.yaml` under a business rule, `evidence/<id>/manifest.yaml` under any
record, `accounts.yaml` beside a `uat` record, `assets/**` as payload. `shared/<family>/<name…>/` carries
the same record shape for a record no single feature owns. The root keeps three readable custodies:
canonical Work, the tracked `ledger-anchor.json`, and untracked runtime custody.

## Decisions this branch took, that srs/1 may want to restate in a record schema

1. **A shared record's id is `<family>.shared.<name…>`.** The id mirrors the directory, and `shared/` sits
   where `features/<feature>/` sits, so `shared/br/audit/trail` is `br.shared.audit.trail`. That makes
   `shared` a reserved feature name: no feature directory may be called `shared`. If the record schemas
   would rather an unowned record name one of its accountable features, say so and the layout check's id
   rule changes with it - but then two shared records can collide on a name, which the directory cannot.

2. **An acceptance criterion's id drops the `br` segment**: `ac.task.title.required.refuses-empty` at
   `features/task/br/title/required/ac/refuses-empty`. That is what the example does, and it is right -
   a criterion is named after its rule, and a rule is already a `br`. It does mean the id alone does not
   say which family the criterion hangs off; nothing else can hold `ac/`, so nothing is lost.

3. **An evidence id is local to its record** (`proves-title`), not a dot-path, and must equal its directory
   name. Uniqueness is therefore per record, not per tree. If the runtime ever needs to name a run globally
   it needs `<record id>/<evidence id>`, not a longer id.

## Questions the layout check deliberately does not answer

- **`shared/` is only for a record more than one feature is accountable for.** The rule is in the layout;
  the check cannot enforce it, because accountability lives in record fields (`appliesTo`, `refs`,
  `crossesFeatures`) that belong to srs/1. `WORK_EMPTY_FAMILY` catches an empty shared family and nothing
  more. Whoever writes the record checker owns "one accountable feature means it is not shared".

- **Which keys count as authored state.** `WORK_PARENT_AUTHORS_STATE` fires on `state`, `proven`,
  `evidence`, `completion` and `activity` on a parent. If srs/1 adds another leaf-only field, add it to
  `STATE_KEYS` in `checks/work-layout.mjs` rather than to a second list somewhere else.

## One repair, at the root

Four evidence manifests in the example were unreadable YAML - the assertion's `outcome` and `observation`
had lost their indentation, so both became duplicate top-level keys and the document failed `uniqueKeys`:

    examples/todo-app/.starciwork/features/login/br/session/restores/evidence/proves-session/manifest.yaml
    examples/todo-app/.starciwork/features/login/impl/todo-app/auth/evidence/proves-auth/manifest.yaml
    examples/todo-app/.starciwork/features/login/nfr/sign-in-timing/evidence/measures-timing/manifest.yaml
    examples/todo-app/.starciwork/features/login/sds/session-store/evidence/proves-session-store/manifest.yaml

Lines 7 and 8 of each file, re-indented under the `- id:` item to match the eleven manifests that were
already correct. It was a typo, not a schema question, so it was fixed here rather than reported; the
example now reports clean. If srs/1 decides an assertion is shaped differently, these four change with the
other eleven.
