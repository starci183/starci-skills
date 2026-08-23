---
title: Retired structure
---

# Retired structure

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@file-layout` | `knowledge/compilers/patterns/fe/file-layout/en.md` | en | accepted component-tier vocabulary |

## Stale signature

An accepted component root still contains a retired `components/shells` tier, including a directory with
zero files. Candidate, preview and artifact trees are not production component roots.

## List evidence

Read `@file-layout`, enumerate accepted roots directly, count every retired directory recursively, count
tracked files separately and search imports/exports through `/shells/`. File-based gates cannot see empty paths.

## Repair inventory

For each live component, resolve identity from exports, mechanics and call sites. The boundary includes its
folder/name, barrel exports, imports, tests and contract references. An unsettled destination is a decision.

## Apply

Remove an empty directory and record before/after counts even though Git has no diff. For live files,
preserve behavior/history and migrate the complete reference graph to the tier `@file-layout` requires.
Never delete live behavior merely to make the tier disappear. This pass is single-writer.

## Proof

No accepted root contains `components/shells`, no source import/export reaches `/shells/`, the installed
`no-shell-tier` gate is active, and the repository's original gates pass.
