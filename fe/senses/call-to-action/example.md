---
id: fe-senses-call-to-action-example
title: example.md
slug: /fe/senses/call-to-action/example
sidebar_label: example.md
sidebar_position: 3
description: Business cases và live StarCi Academy CTA UI/Code.
---

# example.md

> Version: `1.03` · Module: `call-to-action` · Canon: [`INDEX.md`](./INDEX.md) · Tests: [`prompt.md`](./prompt.md) · Audit: [`audit.md`](./audit.md)

Mỗi case ghi business, exact action tree và điểm phân biệt với shape dễ nhầm.

## Example Index

| Case | Closed result | Product proof |
|---|---|---|
| Completion | one primary + tertiary | Finding selects corrective destination |
| Reading page | no primary + TextLink | Quiet path onward |
| Outcome copy | primary | Label names artifact, not mechanism |
| Form anchor | primary + tertiary + furniture | Job owns footer anchor |
| Motivation moment | state-gated primary | Value precedes ask |
| Action tiers | primary + tertiary | Recommendation visible at glance |
| Placement size | tertiary-sm / primary-md | Size independent from priority |
| Pending | primary-md `isPending` | Same promise and geometry |
| Failure | primary retry + TextLink | Restoration plus escape |
| Destructive | `ConfirmButton` | Two-step, explicit result, no danger variant |

## Cases

### 1. Completion finding

**Business:** Quiz evidence names “Cache invalidation” as the weak topic.

**Result:** “Ôn lại Cache invalidation” `primary md`; all-results path `tertiary md`.

**Why:** One destination follows directly from evidence.

**Not when:** “Học tiếp” and an upsell both claim primary.

<CodeUiTabs example="cta-completion" />

### 2. Reading surface

**Business:** Recovery-code guidance has no operation; user can return to Security.

**Result:** no primary; `TextLink` path onward.

**Why:** Absence of conversion is honest, not incomplete.

**Not when:** invent a large “Khám phá thêm” button to fill whitespace.

<CodeUiTabs example="cta-path-onward" />

### 3. Outcome label

**Business:** User wants the August activity report.

**Result:** primary label “Nhận báo cáo tháng 8”.

**Why:** It names what the user receives.

**Not when:** “Chạy truy vấn” exposes internal mechanism.

<CodeUiTabs example="cta-outcome-copy" />

### 4. Form action anchor

**Business:** Save completes course editing; cancel leaves changes; refresh is toolbar furniture.

**Result:** save `primary md`; cancel `tertiary md`; refresh/menu `ghost sm`.

**Why:** Role and placement are independently resolved.

**Not when:** refresh occupies primary anchor beside heading.

<CodeUiTabs example="cta-action-anchor" />

### 5. Motivation moment

**Business:** Analysis must expose three wrong answers before a corrective destination exists.

**Result:** show corrective `primary md` only after analysis settles.

**Why:** User can picture the destination when the ask appears.

**Not when:** ask for a paid report before showing value.

<CodeUiTabs example="cta-motivation-moment" />

### 6. Primary and subordinate tiers

**Business:** Publish 12 lessons is the recommendation; returning to draft is optional.

**Result:** publish `primary md`; back `tertiary md`.

**Why:** Glance reveals product recommendation before labels are parsed.

**Not when:** two equal visual primaries.

<CodeUiTabs example="cta-action-tiers" />

### 7. Same role system, two placements

**Business:** Reply is embedded in an activity row; continue-learning stands alone after lesson value.

**Result:** reply `tertiary sm`; continue `primary md`.

**Why:** Variant follows role, size follows placement.

**Not when:** hand-shrink by changing padding or label length.

<CodeUiTabs example="cta-size-by-placement" />

### 8. Pending save

**Business:** Save request runs while submitted values remain on screen.

**Result:** same primary Button with `isPending: true`.

**Why:** Product leaf preserves label width and blocks duplicate press.

**Not when:** replace the whole form with an anonymous spinner.

<CodeUiTabs example="cta-pending-state" />

### 9. Failed report

**Business:** Transient analytics failure can be retried; history remains safe escape.

**Result:** retry `primary md`; history `TextLink`.

**Why:** Retry is the only viable restoration in this state.

**Not when:** retry remains primary for a permission failure.

<CodeUiTabs example="cta-failure-recovery" />

### 10. Destructive course removal

**Business:** Removing a course loses submissions/feedback and requires a deliberate second press.

**Result:** `ConfirmButton` with explicit resting and armed labels; safe path remains available.

**Why:** Behavior communicates risk without adding an unsupported danger vocabulary.

**Not when:** `Button variant="danger"` or label “Xác nhận”.

<CodeUiTabs example="cta-destructive-confirmation" />

## Boundary Matrix

| Business distinction | Output A | Output B |
|---|---|---|
| Recommended vs subordinate | `primary` | `secondary` |
| Subordinate vs equal alternative | `secondary` | `outline` |
| Optional content action vs furniture | `tertiary` | `ghost`/`TextLink` |
| Embedded vs standalone | `sm` | `md` |
| Ready vs pending | same role/size | `isPending: true` |
| Destructive vs ordinary action | `ConfirmButton` | `Button` |
| No recommendation vs unknown recommendation | quiet onward path | `INSUFFICIENT CONTEXT` |

