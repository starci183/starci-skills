---
name: anthropic-alignment
description: Plan to bring this bundle in line with the official Anthropic skill standard. Read before changing structure, budgets, or descriptions.
status: DRAFT — nothing executed yet
measured: 2026-07-30
---

# Aligning with the Anthropic skill standard

Measured against `anthropics/skills` (12 official skills, 387 files, 3.7 MB) and
`skill-creator/SKILL.md`, which is the standard's own statement of itself.

## What the standard actually says

| Rule | Their number | Ours today |
|---|---|---|
| `SKILL.md` length | **under 500 lines**, split when approaching | 59–85 lines (12–17% of budget) |
| Metadata always loaded | name + description, **~100 words** | 25–45 words, not optimised |
| Reference file needing a table of contents | **over 300 lines** | `matrix.md` is 860 lines, no ToC |
| Bundled resource folders | `scripts/` · `references/` · `assets/` | `scripts/` yes · `references/` at root · no `assets/` |
| Description voice | *"a little bit pushy"*, `Use this skill whenever…` | neutral `Use when…` |
| Instruction voice | imperative | imperative — already aligned |
| Evaluation | `evals/evals.json`, paired with-skill / baseline runs, `grading.json` | **absent** |

Two findings that reverse an assumption:

**We are too short, not too long.** The 700-word ceiling was self-imposed three sessions ago and
is far tighter than the real standard. Content was cut to satisfy a number that was never theirs.

**`frontend-design` — the official skill closest to our domain — is prose, not tables.** It
teaches judgement through narrative and lines like *"Spend your boldness in one place"*. Our
`RULES.md` should stay a lookup sheet, but the pressure to compress everything into tables was
wrong.

## Deliberate deviation, stated once

Anthropic puts `references/` **inside** each skill because their 12 skills are independent
products. Ours are four lanes of **one system** sharing one rulebook, so `references/` stays at
the root and every skill points to it. Duplicating `house-rules.md` into four skills would create
four copies that drift.

This is the only structural deviation. It is recorded here so nobody later "fixes" it.

---

## Phase 1 — Structure

| Move | From | To |
|---|---|---|
| entry template | `library/_TEMPLATE.md` | `assets/library-entry.md` |
| add | — | `assets/` for templates, `evals/` for test cases |

Keep `references/` at root (see deviation above). Add a per-skill `references/` only when a rule
belongs to exactly one lane.

**Done when:** folder layout is `scripts/ · references/ · assets/ · evals/` plus the domain trees
`library/` and `principles/`.

## Phase 2 — Budgets and navigation

1. `writing-skills/SKILL.md`: replace the word-count table with the real standard —
   `SKILL.md` under **500 lines**, reference files over **300 lines** need a table of contents,
   metadata around **100 words**.
2. `scripts/validate.mjs`: switch the budget check from words to lines; add a check that any
   markdown file over 300 lines has a ToC; add a check that every `description` is 60–120 words.
3. `library/matrix.md` (860 lines): add a table of contents over its 21 sections.

**Done when:** `validate.mjs` passes with the new checks active.

## Phase 3 — Descriptions

Rewrite all four `description` fields to the standard's shape:

```
Use this skill whenever <trigger>. Also triggers on <phrases the teacher actually says>.
Not for <the neighbouring lane>.
```

Each around 100 words, listing concrete trigger phrases rather than a summary of the workflow.
The negative clause stays — it is what keeps the four lanes from stealing each other's work.

**Done when:** each description names at least four real trigger phrases and one anti-trigger.

## Phase 4 — Pointers at the point of use

`pdf/SKILL.md` repeats *"If you need to fill out a PDF form, read FORMS.md and follow its
instructions"* six times, each at the moment it matters. We gather every pointer into one
blockquote at the top, which an agent skims past.

Move each pointer next to the step that needs it. Keep at most two in the header.

**Done when:** no skill has more than two pointers in its header, and every step that depends on
a reference names that reference on its own line.

## Phase 5 — Spend the budget we actually have

At 12–17% of the line budget, there is room to put back what was cut for a wrong number. Add only
what belongs to that lane:

*(The four lanes below collapsed into two on 2026-07-30 — `audit-block` and `audit-composition`.
The work still applies, redistributed.)*

| Lane | Put back |
|---|---|
| `audit-block` | one worked round end to end: three inputs, shape read, candidates drawn, verdict; plus one filled-in library entry as a model, not just the blank template |
| `audit-composition` | a real arrangement derived from a real record count, showing how volume forces the split |
| `references/writing-canon.md` | the three-case table with a real incident for each case |

**Not** an invitation to pad. Every addition is a concrete case, never restated principle.

**Done when:** each skill sits between 150 and 300 lines, and every added block is a worked
example rather than more rules.

## Phase 6 — Evaluation

The largest gap. Follow the standard's own shape:

```
evals/
  evals.json          {id, prompt, expected_output, files}  - 3 cases per skill
  agents/grader.md    how to grade a run
  iteration-1/
    eval-0/with_skill/outputs/ · without_skill/outputs/
    grading.json      expectations[] {text, passed, evidence}
```

Rules taken verbatim from the standard: run with-skill and baseline **in the same turn, never
sequentially**; grade against written expectations, not impressions; iterate into
`iteration-<N+1>/` and compare against the previous iteration.

Needs one real case per skill to be worth anything — a screen already known to carry `sạn`, a
screen to build from scratch, an entry to admit.

**Done when:** every skill has 3 eval cases and one graded baseline comparison on record.

## Phase 7 — Improvement loop

The standard's four principles, adopted as our own:

1. Generalise from feedback — do not overfit to the test cases.
2. Keep the prompt lean — delete instructions that never changed an outcome.
3. Explain the why — theory of mind beats rigid rules. *(This is why `rationale.md` exists.)*
4. Watch for repeated work — anything done by hand twice becomes a script.

**Done when:** `writing-skills/SKILL.md` carries these four and the eval loop references them.

---

## Order and stop points

```
P1 structure ─► P2 budgets ─► P3 descriptions ─► P4 pointers
                                                     │
                                    P5 restore cut content
                                                     │
                          P6 evals ◄── needs real cases from the teacher
                                                     │
                                            P7 improvement loop
```

P1 to P4 are mechanical and safe. P5 changes what the skills say and should be reviewed. P6 is
blocked until there are real cases to test against.

## Not doing

- Not splitting `references/` into per-skill copies. See the deviation above.
- Not adding `license` frontmatter — that is Anthropic distribution metadata, not a skill rule.
- Not moving `principles/` or `library/` under a skill. They are the domain, shared by all lanes.
- Not compressing `rationale.md`. Their own design skill proves prose is the right form for
  teaching judgement.
