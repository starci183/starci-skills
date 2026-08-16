---
id: fe-senses-input-index
title: INDEX.md
slug: /fe/senses/input
sidebar_label: input
sidebar_position: 0
description: Compile business value-entry behavior into the closed StarCi Academy input component output.
template: design-canon-v1
---

# INDEX.md

Version: `1.03`

Business tests: [prompt.md](prompt.md) · Vietnamese guide: [vi.md](vi.md) · UI examples: [example.md](example.md)  
Governance: [audit.md](audit.md) · version history: [changelog.md](changelog.md)

## Canon Question

**What value or query can the user edit here, and which existing StarCi input owner already provides
that behavior?**

Compile business facts into `Field`, `Input`, `SearchBox`, `SearchCommandField`,
`PressableInputLike` or a safe stop. Never expose HeroUI variant, raw type, field colour or
adornment taste to callers.

## Required Business Facts

```text
value_purpose: what value/query the user supplies
interaction: edit-value | submit-search | command-search | open-search | display-only
label: persistent user-facing label/accessibility name
kind: email | current-password | new-password | one-time-code | ordinary-text | search
ownership: ordinary-field | leaf-slot | toolbar-search | global-search | navbar-trigger | named-other
state: ready | loading | invalid | disabled | pending
validation_copy: none | <hint/error>
extra_operation: none | reveal-password | clear-search | submit-search | <named action>
```

Missing value purpose, interaction, label or ownership returns `INSUFFICIENT CONTEXT`.

## Closed Output

| Business behavior | StarCi output | Required facts |
|---|---|---|
| Ordinary labeled editable value | `Field` | id, name, label, supported kind |
| Editable leaf where label/help owner already exists | `Input` | id, name, accessible label relationship |
| Toolbar/bar query that accepts and submits text | `SearchBox` | label, placeholder, clear label |
| Controlled global-search combobox with result navigation | `SearchCommandField` | value, label, clear label, result owner |
| Navbar element that only opens search | `PressableInputLike` | label, shortcut/status; never accepts typing |
| Direct action beside a field | owning composite with `Field` + `Button` peers | action has separate name/outcome |
| Display-only value | a display component such as `Text`; not Input | editing is explicitly absent |
| Unsupported value kind/adornment/state | `INSUFFICIENT CONTEXT` | named owner or API change required |

`Input` kinds are closed: `email | password | newPassword | code | text`. The component internally
maps type, autocomplete and inputMode and internally owns the product field treatment.

## Classification Gate

1. Decide whether the user edits text, submits a query, navigates search results, opens search, or
   only reads a value.
2. For an ordinary labeled value emit `Field`; use bare `Input` only when another admitted owner
   already supplies label/help anatomy.
3. Map business kind: email → `email`; current password → `password`; create/reset password →
   `newPassword`; one-time code → `code`; ordinary text → `text`.
4. Search outputs:
   - accepts/submits a toolbar query → `SearchBox`;
   - controlled global combobox with result navigation → `SearchCommandField`;
   - looks like an input but only opens search → `PressableInputLike`.
5. Password visibility is intrinsic only through `revealLabel` and `hideLabel`.
6. Validation belongs to `Field isInvalid` plus hint. Loading/disabled use existing props.
7. A separate action remains a peer `Button`; it is not a decorative suffix.
8. If kind/state/adornment is outside the public API, return `INSUFFICIENT CONTEXT`.

## Output Explanations

### Field is the ordinary form answer

`Field` owns persistent label, `Input`, hint/error relationship and invalid announcement. Business
“email đăng nhập” compiles directly to `Field kind="email"`; it does not choose a visual variant.

### Search has three different behaviors

`SearchBox` accepts a query in a bar. `SearchCommandField` is a controlled combobox inside global
search and owns keyboard result navigation. `PressableInputLike` is a Button-shaped trigger: it
opens search and never accepts text. Similar appearance does not merge these behaviors.

### Kind is behavior, not decoration

Kind selects keyboard, autocomplete, secrecy and parsing. It does not generate envelope/lock/key
icons. Password reveal is allowed because it is a named separate operation with accessible labels.

## Exceptions and Safe Stops

- Public `Input`/`Field` do not support `readOnly`; display-only business returns a display
  component, or stops if editing permission may change.
- Currency/protocol prefixes, date pickers and generic suffix slots are not in the public contract;
  require a named component.
- Ordinary `Input` is uncontrolled by design. A caller demanding controlled `value/onChange`
  needs a named owner/API review; global search already has `SearchCommandField`.
- Pending remote validation has no generic field contract. Preserve the field and route pending
  ownership to a named composite; otherwise stop.
- Caller requests for “quiet”, “outlined”, “secondary”, “p-0” or custom colour never change output.

## Invariants

- Callers never choose raw vendor variant/type/field colour.
- Persistent label/help/error ownership remains intact.
- Kind changes behavior, not decoration.
- Password reveal and search clear have explicit accessible names.
- A trigger that opens search is not an editable input.
- Display-only data is not rendered as a disabled/read-only fake input.
- Direct action remains a separate operable peer.
- Unsupported API needs return `INSUFFICIENT CONTEXT`, not a wrapper invented from utilities.

## Review Output

```text
value_purpose: <business value/query>
interaction: <closed interaction>
owner: Field | Input | SearchBox | SearchCommandField | PressableInputLike | <named composite>
kind: email | password | newPassword | code | text | component-owned
label: <persistent/accessibility label>
state: ready | loading | invalid | disabled | pending
extra_operation: none | intrinsic-reveal | intrinsic-clear | peer-action
result: resolved | INSUFFICIENT CONTEXT
evidence: <fact selecting behavior and owner>
```

## Load Policy

1. Apply `INDEX.md` first.
2. Read `prompt.md` for business-only stress tests.
3. Read `vi.md` for Vietnamese explanation.
4. Read `example.md` for product UI/Code.
5. Load governance only for audit/version work.

## Version Rule

`changelog.md` owns the module version. Accepted changes increment `0.01` and update all six records.
