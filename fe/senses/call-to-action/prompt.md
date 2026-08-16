---
id: fe-senses-call-to-action-prompt
title: prompt.md
slug: /fe/senses/call-to-action/prompt
sidebar_label: prompt.md
sidebar_position: 1
description: Business-only self-tests for the StarCi Academy CTA compiler.
---

# prompt.md

> Version: `1.03` · Module: `call-to-action` · Canon: [`INDEX.md`](./INDEX.md) · Audit: [`audit.md`](./audit.md)

The prompt never names a variant or size. The compiler must derive one action tree or stop.

## Evaluation Summary

| Result | Cases | Verdict |
|---|---|---|
| Unique action tree | 1–15 | Job, recommendation, placement and state select one tree |
| `INSUFFICIENT CONTEXT` | 16–18 | Recommendation/destination/placement missing |
| Ambiguous after gate | none | Equal alternatives are represented without fake primary |
| Canon/FE conflict | none | Output uses current `Button`, `TextLink`, `ConfirmButton` vocabulary |

Verdict: **18/18 safe**; 15 trees compile and 3 stop without inventing priority.

## Cases

### 1. Course pricing rail

**Business:** A learner has seen title, curriculum, price and enrolment proof. The rail is the one
place asking them to buy. They may add to cart, preview the learning path or inspect price detail.

**Reasoning:** Checkout is the sole recommendation; the rail is standalone. Cart is subordinate,
trial optional, detail navigation.

**Result:** checkout `primary md`; cart `secondary md`; trial `tertiary md`; detail `TextLink`.

### 2. Mobile enrol bar

**Business:** Deep in a long curriculum, the pricing rail has scrolled away. A pinned mobile bar
repeats payable price and the same enrol outcome.

**Reasoning:** Recommendation is unchanged; placement is compact/persistent.

**Result:** enrol `primary sm` through `course-mobile-action-bar`.

### 3. Course completion finding

**Business:** Result says two wrong answers share “Cache invalidation”. The learner can review that
topic or inspect all answers.

**Reasoning:** Evidence recommends one corrective destination.

**Result:** “Ôn lại Cache invalidation” `primary md`; “Xem toàn bộ kết quả” `tertiary md`.

### 4. Authentication providers

**Business:** Email/password is the main sign-in route; Google and GitHub are equivalent alternative
ways to enter the same account.

**Reasoning:** Providers are alternatives instead of the form, not lesser recommendations.

**Result:** submit `primary md`; each provider `outline md`.

### 5. Reading guidance

**Business:** A recovery-code article has no operation to complete; the user can return to Security.

**Reasoning:** Informational surface has no primary ask.

**Result:** no primary; `TextLink` “Quay lại Bảo mật tài khoản”.

### 6. Empty course search

**Business:** Search settled with no result. User can clear filters and search again.

**Reasoning:** This is a settled recovery path inside an empty composite, not the product's main task.

**Result:** `EmptyNotice` action → `secondary sm`.

### 7. Failed report with viable retry

**Business:** Report generation failed transiently; data and permission remain valid. Retry restores
the blocked report flow, while history is an escape.

**Reasoning:** Retry is the one viable restoration in this failed state.

**Result:** retry `primary md`; history `TextLink`.

### 8. Permission failure

**Business:** Report failed because the viewer lacks analytics permission. Retrying cannot succeed;
they can return to course administration.

**Reasoning:** Ineligible retry is removed before priority selection.

**Result:** no primary; back path `ghost sm` or `TextLink`.

### 9. Activity-row reply

**Business:** An Nguyễn commented on a lab. “Trả lời” sits within that row; opening the discussion is
useful but not a surface recommendation.

**Reasoning:** Embedded optional action.

**Result:** “Trả lời” `tertiary sm`.

### 10. Save course form

**Business:** Editor changed title/description. Save completes the form; cancel leaves it; refresh is
toolbar furniture.

**Reasoning:** One form outcome at standalone anchor; other roles are distinct.

**Result:** save `primary md`; cancel `tertiary md`; refresh `ghost sm`.

### 11. Pending save

**Business:** Save request is running. The submitted values remain visible and duplicate submission
must be blocked.

**Reasoning:** State changes behavior, not the promised outcome or geometry.

**Result:** same `primary md` Button with `isPending: true` and original outcome label.

### 12. Delete basket contents

**Business:** Clearing a basket is reversible only by re-adding courses. A stray press must not clear
it, and the second press must name the result.

**Reasoning:** Destructive behavior is a two-step product control.

**Result:** `ConfirmButton {label: "Xóa giỏ hàng", confirmLabel: "Xóa toàn bộ khóa học"}`.

### 13. Back from project detail

**Business:** The user can leave a project detail and return to Projects. It is navigation, not the
surface's task.

**Reasoning:** Back path lives in page furniture.

**Result:** `ghost sm`.

### 14. Equal quiz modes

**Business:** “Trắc nghiệm” and “Tự đánh giá” are equal modes before a selection; one is currently
selected.

**Reasoning:** This is a choice state, not two CTAs.

**Result:** use choice control or selected `primary` / unselected `outline`; do not count these as
surface primary asks.

### 15. Optional course trial

**Business:** Purchase remains the recommendation after price evidence. Trial lets an undecided user
sample content without blocking checkout.

**Reasoning:** Optional low-emphasis path, standalone in the pricing rail.

**Result:** trial `tertiary md`.

### 16. “Add a CTA to this card”

**Business:** Add a CTA to the course card.

**Reasoning:** Surface job, recommendation and destination are absent.

**Result:** `INSUFFICIENT CONTEXT`.

### 17. “Continue”

**Business:** Put a Continue button at the bottom.

**Reasoning:** Bottom does not identify destination, placement owner or value evidence.

**Result:** `INSUFFICIENT CONTEXT`.

### 18. Two business owners demand primary

**Business:** Learning wants “Tiếp tục bài”; Commerce wants “Nâng cấp Pro”; neither has an approved
recommendation rule for this completion surface.

**Reasoning:** Two primary claims remain and business has not chosen the surface job.

**Result:** `INSUFFICIENT CONTEXT`; escalate product priority, do not style both primary.

## Ambiguity and Conflict Log

| Item | Resolution in `1.03` |
|---|---|
| Old demo used `danger` | Replaced by actual `ConfirmButton` behavior; `danger` is not in product vocabulary |
| Secondary vs outline was vague | Secondary is subordinate; outline is an alternative instead of the main route |
| `sm` vs `md` looked subjective | Closed by placement: embedded/persistent vs standalone |
| Selection controls use primary | Classified as selected state, not surface CTA count |

## Rubric

The canon passes when it finds zero-or-one recommendation, classifies every remaining path, chooses
size from placement, preserves state semantics, uses `ConfirmButton` for destructive acts and stops
when business priority is unresolved.

