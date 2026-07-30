---
name: migration-plan
description: Status of the migration from the old `.claude` to this bundle. Use when you need to know what's still missing, what's already done.
updated: 2026-07-30
---

# Migrating `.claude` to `.claude-max-pro-vip`

This bundle is written fresh from scratch. The old `.claude` stays untouched until the cutover.

## Done

| Task | Result |
|---|---|
| Backed up `_canon_tmp` | `D:\Repositories\_backup\canon_tmp_2026-07-30` — 244/244 files, matched |
| Inventoried 214 source files | `CANON-TMP-TRIAGE.md`. No file classified as "drop" |
| Entry point + dispatch | `CLAUDE.md` · `skills/INDEX.md` |
| Two lanes | `starci-fe-story-audit-block` (shape decides the entry) · `starci-fe-story-audit-composition` (volume decides the arrangement). The four earlier lanes were split by process, not by judgement, and collapsed on 2026-07-30 |
| 15 axes rewritten | each axis: `RULES.md` quick lookup + `rationale.md` verbatim + `example.html` |
| Lookup tool | `scripts/lookup.mjs`, working |

## Still missing

| Task | Blocked on |
|---|---|
| Filter the 76 source files: **library entry** or **ruling** | must read each file, can't automate |
| Admit `foundations/` (11 entries) | after filtering |
| Admit `atoms/` (28 entries) | after `foundations` |
| Admit `frames/` + `composites/` | after `atoms` |
| Migrate the 8 old-generation skills, or bury them | waiting on the teacher's call |
| Split `docs/references.md` (1,042 KB) of the old `.claude` | untouched so far |
| Cutover: `.claude` → legacy | after the library is usable |

## Four questions for the teacher

1. Two generations of `principles/` — 7 old files have no corresponding axis: open a new axis, push them down into `references/`, or split off `principles/product/`?
2. 8 old-generation skills — which ones to revive?
3. 19 uncommitted files in the private canon repo — will the teacher push them, or should I draft the commit?
4. Load threshold: `CLAUDE.md` is at 218 words, over the 200-word cap I set myself. Raise the cap or cut the text?

## Load budget

| Action | `.claude` (old) | This bundle |
|---|---:|---:|
| Open a feedback session | ~220 KB | ~8 KB |
| Look up one entry | 15 KB | ~1 KB |
| **Admit a new entry** | 220 KB | **220 KB — kept as-is, on purpose** |

The last row is the condition for the whole plan: don't cut cost where it's worth paying for.
