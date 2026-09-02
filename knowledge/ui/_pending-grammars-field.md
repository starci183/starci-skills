> Awaiting relocation into knowledge/grammars/<family>/. This file describes Grammar component
> mechanics, not an application decision. It has no successor under composition, presentation, or
> proof. Do not load it as runtime authority.

# Field

Use these rules to audit one field's label, control, guidance, validation, requirement, value, and
availability as a single owned relationship. Business/application authority supplies the domain
copy, value, validation fact, and mutation; `@starci/grammar/common` owns the public field props,
anatomy, DOM relationships, and accessibility; a family may change scoped paint without changing
that contract. Component-to-rule bindings stay in the separate binding registry. Record findings
with the [canonical verdict model](INDEX.md#canonical-verdict-model), one base verdict per finding and
linked findings for independent failed layers.

## FIELD-1 — One owned field stack

### When

One editable value needs a visible identity and may also need guidance, validation, requirement, or
availability state.

### Apply

- Use Common `Input` as the one owner and supply its real public slots: `id`, `name`, `label`, value
  or `defaultValue`, `hint`, `errorMessage`, `isError`, `isDisabled`, `isRequired`, and
  `onValueChange` as applicable.
- Common composes its label, description, native input, and internal error-message renderer under one
  text-field owner; verify the resulting accessible name and descriptions rather than inferring them
  from source component names.
- The application owns the words, current value, validation fact, and change effect. A family may
  style the published anatomy, but neither layer may add a second field wrapper or vendor leaf.
- Require one visible label, one editable control, one value authority, and zero detached or duplicate
  label/guidance/error owners.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| Common `Input` renders “Work email”, the named native input, its hint, and the authority-backed value as one relationship. | `PASS` | The public owner and rendered semantic relationship agree. |
| Common lacks a reusable field owner for a required control shape. | `COMMON_CAPABILITY_MISSING` | Add a named Common capability before an app assembles vendor leaves. |
| App code wraps a Common `Input` with a second label and description system. | `APP_REIMPLEMENTATION` + `DOUBLE_OWNER` | Remove the duplicate wrapper and supply content through Common slots. |
| A family replacement drops the label while retaining the input. | `FAMILY_OVERRIDE_GLITCH` + `WRONG_OWNER` | Restore the complete props-compatible field anatomy. |
| The screenshot shows a label, but no accessible-name or description trace exists. | `PROOF_MISSING` | Capture the rendered semantic tree and relationship IDs before PASS. |

## FIELD-2 — Helper and error have different jobs

### When

The field may need prospective guidance and a current corrective validation message.

### Apply

- Put format or consequence guidance in `Input.hint`; put the current failure and correction in
  `Input.errorMessage`. The presence of `errorMessage`, or public `isError`, makes the Common field
  invalid.
- `isError` is the Common public state prop. The renderer's HeroUI `isInvalid` and
  `ErrorMessage` are internal vendor details, not app-facing Common APIs or separate app slots.
- Update or remove `errorMessage` when validation truth changes. Verify visible copy,
  `aria-invalid`, and the field's programmatic description in the same rendered state.
- A family may paint invalid state but must not hide corrective copy. App code owns validation truth
  and wording, not error anatomy or a second live/error region.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| `hint="Use your work address"` is guidance; a current rejected value supplies `errorMessage="Enter a work email"` and renders invalid semantics. | `PASS` | Guidance and correction have distinct content and one Common owner. |
| App code imports a vendor `ErrorMessage` beside Common `Input`. | `APP_REIMPLEMENTATION` + `VENDOR_LEAK` + `DOUBLE_OWNER` | Remove the vendor leaf and use `Input.errorMessage`. |
| App code tries to treat vendor `isInvalid` as a Common `Input` prop. | `APP_REIMPLEMENTATION` + `VENDOR_LEAK` | Bind the business fact to public `isError` or `errorMessage`. |
| Isolated Common shows `errorMessage` but does not expose invalid or descriptive semantics. | `COMMON_IMPLEMENTATION_GLITCH` | Repair the Common mapping and add rendered DOM coverage. |
| The error looks correct, but its relationship to the input was not inspected. | `PROOF_MISSING` | Verify accessible name, invalid state, and descriptions together. |

## FIELD-3 — Unavailability preserves identity and work

### When

A known field and its value remain relevant, but editing cannot currently start or continue.

### Apply

- Keep the same Common `Input` mounted and pass `isDisabled`; keep `label` and the current
  authority-backed `value` or `defaultValue` rather than clearing or replacing them.
- If the reason belongs to this field's guidance, the application supplies it through the existing
  `hint` slot. Common exposes no separate `disabledReason` prop; do not invent one locally.
- Verify the native input is disabled, its visible identity and value remain, `onValueChange` does not
  mutate authority, and re-enabling resumes from preserved work.
- Use `isSkeleton` only for initially unresolved field geometry. A family may paint disabled state
  but must not turn it into loading or conceal the value.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| A disabled email `Input` keeps its label and verified address visible, and no change callback mutates the value. | `PASS` | Availability changed without erasing identity or work. |
| App code clears the value when permission changes to unavailable. | `APP_OVERRIDE` + `STATE_OR_VIEWPORT_DRIFT` | Preserve the authority-backed value and disable only editing. |
| App substitutes `isSkeleton` for a known but unavailable field. | `APP_OVERRIDE` + `VALUE_DRIFT` | Drive `isDisabled`; skeleton means unresolved initial content. |
| A family hides disabled text or the visible label. | `FAMILY_OVERRIDE_GLITCH` + `VALUE_DRIFT` | Restore legible identity and value under disabled paint. |
| Re-enable and value-preservation paths were not exercised. | `PROOF_MISSING` | Record value, callback count, and semantics before, during, and after disablement. |

## FIELD-4 — Evidence and falsifiers

### When

Label, value, requirement, validation, availability, skeleton, input method, text scale, or viewport
can change the field's rendered relationship.

### Apply

- Execute the matrix for default, filled, required, invalid, disabled, and skeleton states plus every
  relevant value transition and correction path.
- Inspect source public props, isolated Common DOM, the selected family delta, app wrappers, visible
  copy, native input behavior, focus order, and the accessibility tree.
- Require one accessible name, current descriptions, correct required/invalid/disabled semantics,
  disabled mutations = `0`, preserved known value, and hidden unresolved content where promised.
- Attribute each failure to Common, family, or app independently; visual resemblance and vendor
  behavior assumed from source are not runtime proof.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| Every required state has matching visible copy, native semantics, relationship, value, and callback evidence. | `PASS` | The full field contract is proven. |
| Isolated Common duplicates the error in two described nodes. | `COMMON_IMPLEMENTATION_GLITCH` + `DOUBLE_OWNER` | Keep one Common error relationship and rerun semantic-tree tests. |
| App CSS hides the visible label while leaving only the placeholder. | `APP_OVERRIDE` + `WRONG_OWNER` | Remove the override; placeholder is not field identity. |
| A family makes invalid and default fields visually indistinguishable. | `FAMILY_OVERRIDE_GLITCH` + `VALUE_DRIFT` | Restore a perceivable invalid treatment without changing the Common state. |
| Only default desktop output was checked. | `PROOF_MISSING` | Add required, invalid, disabled, skeleton, keyboard, text-scale, and reflow evidence. |
