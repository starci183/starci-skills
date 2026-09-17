# srs-3: the Work layout and its checker

Branch `srs/3` owns `schemas/work-layout.yaml` and `checks/work-layout.mjs`. The per-record schemas
(`srs/1`) and the record checker (`srs/2`) are not written here. What follows is what this branch decided,
what it repaired, where the brief and the disk disagreed, and the questions the record schemas still owe.

## What the layout says now

`schemas/work-layout.yaml` is rewritten to `starci/work-layout@4`, describing the tree that
`examples/todo-app/.starciwork` actually is. The previous `@3` described `features/<f>/business/srs/**`,
`extensions.work3` payloads and per-rule folders under a `business` tier; none of that exists on disk any
more, and the example is authoritative.

Eleven families under a feature: `br fr nfr data journey decision integration sds ui impl uat`. One
directory per record, holding `index.yaml`. `ac/<name>/index.yaml` under a business rule, `accounts.yaml`
beside a `uat` record, `assets/**` as payload. Evidence is a block inside the record's own `index.yaml`,
not a file of its own. `shared/<family>/<name…>/` carries the same record shape for a record no single
feature owns. The root keeps three readable custodies: canonical Work, the tracked `ledger-anchor.json`,
and untracked runtime custody.

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

3. **An evidence block has no id of its own.** It is written into the record it proves and is identified
   by that record. If the runtime ever needs to name one run among several it needs a second key inside
   the block, not a directory and not a longer id - a directory is what `WORK_EVIDENCE_MISPLACED` refuses.

4. **`integration.<feature>.<provider>`** mirrors `features/<feature>/integration/<provider>`, so a
   provider appears once per feature. Two Keycloak realms in one feature would need two names.

## Questions the layout check deliberately does not answer

- **`shared/` is only for a record more than one feature is accountable for.** The rule is in the layout;
  the check cannot enforce it, because accountability lives in record fields (`appliesTo`, `refs`,
  `crossesFeatures`) that belong to srs/1. `WORK_EMPTY_FAMILY` catches an empty shared family and nothing
  more. Whoever writes the record checker owns "one accountable feature means it is not shared".

- **Which keys count as authored state.** `WORK_PARENT_AUTHORS_STATE` fires on `state`, `proven`,
  `provenBy`, `requiresProof`, `evidence`, `completion` and `activity` on a parent. If srs/1 adds another
  leaf-only field, add it to `STATE_KEYS` in `checks/work-layout.mjs` rather than to a second list.

- **Whether `recordDigest` is checkable from the layout.** It is not: recomputing the normative digest of
  a record means knowing which fields are normative, which is a record-schema fact. The layout check reads
  exactly one field of a record, its `id`, plus `evidence.record` when the block names one.

## Where the brief and the disk disagreed, and what the disk said

The task brief and the coordinator's follow-up both describe a tree that `main` no longer carries. The
brief says the example is authoritative, so the disk won each time. Three disagreements, for the record:

1. **Ten families, or eleven.** Both messages say ten. `4b64eea7` added an eleventh,
   `features/login/integration/keycloak/index.yaml` and `features/login/integration/postgres/index.yaml`,
   with `schema: work/integration` and ids `integration.login.keycloak` / `integration.login.postgres`.
   The layout and `FAMILIES` carry eleven. An external system is a record, not a remark, and it needs a
   family of its own to be one.

2. **Evidence is not a file.** The coordinator asks for `evidence/<id>/manifest.yaml` "beside the record
   it proves" and for a record that carries `evidence: <directory>`. After `f3e3e5b9` and `9d6be5e8` the
   example holds no `manifest.yaml` at all - all eighteen were deleted - and `evidence:` is a mapping
   written into the record's own `index.yaml`, carrying `recordDigest`, `outcome`, `assertions` and
   `provenance` (see `features/task/br/title/required/index.yaml` lines 11-27 and
   `features/login/integration/keycloak/index.yaml` lines 29-49). So `WORK_EVIDENCE_MISPLACED` exists and
   means what the coordinator said it should mean - proof that has drifted from its subject - but it
   fires on the shapes the current tree can actually produce: an `evidence/` directory or a `manifest.yaml`
   beside a record, and an inline `evidence` block whose `record` names a record other than its own.

3. **`proven` is gone.** Records author `requiresProof`; the kernel writes `provenBy` and `evidence`. All
   three joined `state` in the leaf-only key set, so a parent that authors any of them is still caught.

## One repair, at the root

Before the merge with `main`, four evidence manifests in the example were unreadable YAML - the assertion's `outcome` and `observation`
had lost their indentation, so both became duplicate top-level keys and the document failed `uniqueKeys`:

    examples/todo-app/.starciwork/features/login/br/session/restores/evidence/proves-session/manifest.yaml
    examples/todo-app/.starciwork/features/login/impl/todo-app/auth/evidence/proves-auth/manifest.yaml
    examples/todo-app/.starciwork/features/login/nfr/sign-in-timing/evidence/measures-timing/manifest.yaml
    examples/todo-app/.starciwork/features/login/sds/session-store/evidence/proves-session-store/manifest.yaml

Lines 7 and 8 of each file, re-indented under the `- id:` item to match the fourteen manifests that were
already correct. It was a typo, not a schema question, so it was fixed here rather than reported. `main`
then deleted every manifest, evidence having moved inside the records, and the merge resolved all four in
favour of that deletion - so the repair is now only a note that the defect existed and was not a layout
question.
