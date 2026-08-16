---
id: fe-senses-input-audit
title: audit.md
slug: /fe/senses/input/audit
sidebar_label: audit.md
sidebar_position: 4
description: Advisory audit for the StarCi Academy Input compiler.
---

# audit.md

> Version: `1.03` · Module: `input` · Canon: [`INDEX.md`](./INDEX.md) · Tests: [`prompt.md`](./prompt.md)

## Current Verdict

| Area | Verdict | Evidence |
|---|---|---|
| Closed output | Pass | Five actual product owners plus safe stop |
| Business compiler | Pass | 18 business-only cases |
| FE alignment | Pass after correction | Public `Input`, `Field` and search APIs inspected |
| Unsupported states | Pass | Read-only/adornment/date/pending debt stops safely |
| Template | Pass | `design-canon-v1` order |

## Self-Test Results

| Class | Count | Result |
|---|---:|---|
| Unique output | 12 | Behavior/ownership selects component |
| Safe stop | 6 | Unsupported API/missing behavior does not create wrapper |
| Ambiguous after gate | 0 | Search/display/edit jobs are disjoint |
| Canon/FE conflict | 4 corrected | Old docs exceeded public API |

## Findings

| ID | Finding | Severity | Disposition |
|---|---|---:|---|
| IN-A01 | Old ground model implied caller-selectable appearances | P0 | Closed; product Input owns internal treatment |
| IN-A02 | Read-only was canonized but public API lacks it | P0 | Removed; display component or safe stop |
| IN-A03 | Prefix/suffix was treated generically | P0 | Restricted to named intrinsic operations |
| IN-A04 | Search behavior was collapsed into Input | P1 | Split into three product owners |
| IN-A05 | Generic pending validation had no behavior contract | P1 | Safe stop until named composite exists |
| IN-A06 | Existing UI registry still imports raw HeroUI Input for some historical demos | P1 | Content now rejects that as caller canon; live product-leaf migration remains |

## Accepted Decisions

- `Field` is the default for ordinary labeled value entry.
- Bare `Input` requires another admitted label/help owner.
- SearchBox, SearchCommandField and PressableInputLike are behaviorally distinct.
- Kind maps to product behavior, never icons.
- Unsupported public API returns a safe stop.
- `prompt.md` records the exact FE conflicts instead of normalizing them away.

## Re-audit Triggers

- Input/Field public props add read-only, prefix, suffix, date or controlled value.
- A pending-validation composite is introduced.
- Search owner behavior changes.
- A live example emits a raw HeroUI variant as caller code.
- Common template changes.
