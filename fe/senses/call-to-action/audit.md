---
id: fe-senses-call-to-action-audit
title: audit.md
slug: /fe/senses/call-to-action/audit
sidebar_label: audit.md
sidebar_position: 4
description: Advisory audit for the StarCi Academy CTA compiler.
---

# audit.md

> Version: `1.03` · Module: `call-to-action` · Canon: [`INDEX.md`](./INDEX.md) · Tests: [`prompt.md`](./prompt.md)

Audit checks whether business resolves to one action tree and whether that tree exists in FE.

## Current Verdict

| Area | Verdict | Evidence |
|---|---|---|
| Business compiler | Pass | Required job/state/outcome/recommendation/placement facts |
| Closed vocabulary | Pass | Five Button variants, two sizes, TextLink and ConfirmButton |
| Self-test | Pass | 15 unique trees, 3 safe stops |
| Destructive behavior | Corrected | Unsupported `danger` removed from canon/examples |
| Template | Pass | `design-canon-v1` order enforced |

## Self-Test Results

| Class | Count | Notes |
|---|---:|---|
| Unique action tree | 15 | Includes pricing, completion, auth, states and destructive behavior |
| Safe stop | 3 | Missing destination or unresolved recommendation |
| Ambiguous after gate | 0 | Equal alternatives stay equal |
| Canon/FE conflict | 0 open | Output aligns with current product leaf API |

## Findings

| ID | Finding | Severity | Disposition |
|---|---|---:|---|
| CTA-A01 | Old docs treated secondary/tertiary loosely | P0 | Closed roles and boundary tests added |
| CTA-A02 | Old destructive demo used HeroUI `danger`, absent from product Button | P0 | Replaced with `ConfirmButton` contract |
| CTA-A03 | Size rule lacked exact output | P1 | `sm` embedded/persistent, `md` standalone |
| CTA-A04 | Selected-state primary could be counted as CTA | P1 | Explicit exception and prompt case added |
| CTA-A05 | Sticky mobile CTA can cover content/safe area | P2 | Only named `course-mobile-action-bar` owner is admitted |
| CTA-A06 | Outcome labels can exceed compact room | P2 | Keep accessible outcome; content audit remains separate |

## Accepted Decisions

- CTA now compiles a whole action tree, not one “main button”.
- `outline` means alternative instead of main; `secondary` means subordinate.
- Variant and size are independent axes with closed product outputs.
- No-primary surfaces remain valid when a quiet path onward exists.
- Destructive action is behavioral `ConfirmButton`, never a new colour variant.
- Business-only prompts are required before canon is considered unambiguous.

## Re-audit Triggers

- Product Button adds/removes a variant or size.
- A valid surface requires two simultaneous recommendations.
- Persistent mobile action owner changes.
- ConfirmButton behavior or reversibility policy changes.
- A prompt still admits two action trees after required facts are present.

