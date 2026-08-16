---
id: fe-senses-input-prompt
title: prompt.md
slug: /fe/senses/input/prompt
sidebar_label: prompt.md
sidebar_position: 1
description: Business-only self-tests for the StarCi Academy Input compiler.
---

# prompt.md

> Version: `1.03` · Module: `input` · Canon: [`INDEX.md`](./INDEX.md) · Audit: [`audit.md`](./audit.md)

Prompts contain business behavior, not component/variant/class names.

## Evaluation Summary

| Result | Cases | Verdict |
|---|---|---|
| Unique product output | 1–12 | Interaction, ownership and kind choose one owner |
| `INSUFFICIENT CONTEXT` | 13–18 | Unsupported API or missing behavior safely stops |
| Ambiguous after gate | none | Search behaviors and display-only values are separated |
| Canon/FE conflict | cases 13–16 | Old generic advice exceeded current public API |

Verdict: **18/18 safe**; 12 compile and 6 stop without inventing a field.

## Cases

### 1. Sign-in email
**Business:** User enters the email for their account; label remains visible.  
**Reasoning:** Ordinary labeled editable value with email keyboard/autocomplete.  
**Result:** `Field kind="email"`.

### 2. Current password
**Business:** User enters an existing secret and may explicitly show/hide it.  
**Reasoning:** Current-password autocomplete; reveal is a named operation.  
**Result:** `Field kind="password"` with `revealLabel` and `hideLabel`.

### 3. Create a password
**Business:** User creates a new secret during reset.  
**Reasoning:** Autocomplete meaning differs from current password.  
**Result:** `Field kind="newPassword"`.

### 4. One-time code
**Business:** User enters a six-digit verification code from email.  
**Reasoning:** Numeric keyboard and one-time-code autocomplete.  
**Result:** `Field kind="code"`.

### 5. Course title
**Business:** Editor enters a normal course name with persistent label.  
**Reasoning:** Ordinary text.  
**Result:** `Field kind="text"`.

### 6. Catalog toolbar search
**Business:** User types a query, submits it, and can clear it in a toolbar.  
**Reasoning:** Editable/submittable search bar.  
**Result:** `SearchBox`.

### 7. Navbar search trigger
**Business:** Compact navbar control opens global search; typing only starts after overlay opens.  
**Reasoning:** Trigger, not field.  
**Result:** `PressableInputLike`.

### 8. Global search command field
**Business:** Overlay has a controlled query, up/down result navigation, submit and pending indicator.  
**Reasoning:** Combobox behavior and result owner are explicit.  
**Result:** `SearchCommandField`.

### 9. Invalid email
**Business:** Submitted email is malformed; visible error explains the accepted format.  
**Reasoning:** Label/input/hint are one field contract.  
**Result:** `Field kind="email" isInvalid hint="<error>"`.

### 10. Loading profile form
**Business:** Profile value is not loaded yet and the field must preserve geometry.  
**Reasoning:** Existing loading prop owns skeleton.  
**Result:** `Field isLoading`.

### 11. Disabled during submit
**Business:** Request is pending and duplicate edits/submission are blocked while current value stays
understandable.  
**Reasoning:** Existing disabled state.  
**Result:** `Field disabled` inside the submitting form owner.

### 12. Invite by email
**Business:** User enters an email and presses “Mời học viên”; input and operation are separate peers.  
**Reasoning:** Action has its own outcome and accessible name.  
**Result:** owning composite with `Field kind="email"` + peer `Button`.

### 13. Read-only student ID
**Business:** Student ID is displayed but cannot be edited.  
**Reasoning:** Public Field has no read-only state and no editing job exists.  
**Result:** display component such as `Text`; if permission may change, `INSUFFICIENT CONTEXT`.

### 14. Currency prefix
**Business:** Tuition editor requests a “₫” prefix inside the field.  
**Reasoning:** Public Input has no generic prefix slot or currency parsing owner.  
**Result:** `INSUFFICIENT CONTEXT`; require named money component.

### 15. Course start date
**Business:** Editor chooses a calendar date.  
**Reasoning:** `date` is outside the closed Input kind union; date-picker behavior is missing.  
**Result:** `INSUFFICIENT CONTEXT`; require named date component.

### 16. Controlled ordinary input
**Business:** Caller wants to pass `value/onChange` to every ordinary form field for local taste.  
**Reasoning:** Product Input is uncontrolled by design; no named controlled owner.  
**Result:** `INSUFFICIENT CONTEXT`; review API/owner rather than bypass it.

### 17. “Make this field quieter”
**Business:** Field looks too loud on this card.  
**Reasoning:** No value behavior changes; caller appearance is not an input.  
**Result:** `INSUFFICIENT CONTEXT`; inspect surface/boundary owner.

### 18. Pending username validation
**Business:** Username availability checks remotely while the learner continues typing; prompt omits
whether typing stays enabled and who announces the result.  
**Reasoning:** Generic Input has no pending-validation contract.  
**Result:** `INSUFFICIENT CONTEXT`; name a validation composite and behavior.

## Ambiguity and Conflict Log

| Item | Resolution in `1.03` |
|---|---|
| Page versus bounded ground previously implied multiple appearances | Product `Input` owns one internal treatment; caller cannot vary it |
| Read-only was documented but unsupported | Route display-only values away from Input or stop |
| Prefix/suffix looked generally available | Only intrinsic password/search operations; other adornments require named owner |
| Search looked like one kind | Split into `SearchBox`, `SearchCommandField`, `PressableInputLike` |
| Pending validation was illustrated generically | Safe stop until behavior/announcer owner is named |

## Rubric

The canon passes when business behavior selects one existing product owner, kind remains behavioral,
search triggers are not mistaken for fields, and unsupported adornment/state/API requests stop.
