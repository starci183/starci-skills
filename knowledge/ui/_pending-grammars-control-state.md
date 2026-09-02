> Awaiting relocation into knowledge/grammars/<family>/. This file describes Grammar component
> mechanics, not an application decision. It has no successor under composition, presentation, or
> proof. Do not load it as runtime authority.

# Control state

Use these rules to audit how a control carries transient, persistent, unavailable, pending, and
initially unresolved states. Business/application authority owns the fact and its transitions;
`@starci/grammar/common` owns the public props, renderer anatomy, DOM semantics, and accessibility;
the selected family may change scoped paint but not meaning; application handlers own product
effects. Component-to-rule bindings remain in the binding registry, outside this invariant file.
Record findings with the [canonical verdict model](INDEX.md#canonical-verdict-model), using one base
verdict per finding and linked findings when more than one layer fails.

## CONTROL-STATE-1 — Stable identity through action state

### When

An action can move from idle to accepted work and then to a settled result.

### Apply

- Application state sets `Button.isPending` or `TextAction.isPending` only after that action accepts
  the work, and clears it on success, error, or cancellation.
- Common keeps `children` as the visible action label. Pending disables the native button, blocks its
  handler, exposes busy state, and may replace only leading/trailing decoration with its spinner.
- Verify one accepted effect, zero additional callbacks while pending, the same action name in the
  DOM/accessibility tree, and a reachable settlement path.
- A family may paint the pending cue under its scope; it must not replace the label or change the
  transition. The application supplies the handler and result, not control anatomy.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| A pending Common `Button` still reads “Save”, is disabled, exposes busy state, and a second press produces no callback. | `PASS` | Identity, semantics, and effect count agree through the transition. |
| The Common renderer removes `children` while `isPending` is true. | `COMMON_IMPLEMENTATION_GLITCH` + `STATE_OR_VIEWPORT_DRIFT` | Repair Common so pending preserves the action name, then rerun DOM and callback proof. |
| A family replacement changes “Save” to “Loading…” during pending. | `FAMILY_OVERRIDE_GLITCH` + `VALUE_DRIFT` | Keep the family cue visual and restore the Common label contract. |
| App code swaps the button for an unrelated spinner after accepting the save. | `APP_REIMPLEMENTATION` + `WRONG_OWNER` | Keep the Common initiator mounted and drive its published pending prop. |
| The pending screenshot exists but callback count and accessible name were not captured. | `PROOF_MISSING` | Record the DOM, accessible name, and activation count before deciding PASS. |

## CONTROL-STATE-2 — Unavailable is not pending

### When

A control cannot start, has accepted work in flight, or is only unresolved initial geometry.

### Apply

- Map unavailable to the real owner's `isDisabled`, accepted work to `isPending`, and initial
  unresolved content to that component's published `isSkeleton`; do not derive one from another.
- For `Button`, all three block activation, but only pending exposes action progress and only skeleton
  hides unresolved label content from assistive output. `TextAction` publishes the same three inputs;
  `Input` publishes `isDisabled` and `isSkeleton`, not pending.
- Verify the rendered element, busy/disabled/accessibility output, callback count, and transition into
  and out of each meaning instead of comparing paint alone.
- Business authority supplies the reason and lifecycle. Common carries the state, a family paints it,
  and app code must not invent a generic local `loading` state that collapses the meanings.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| An unavailable Common `Button` is disabled with no spinner or busy claim, while accepted work uses `isPending`. | `PASS` | The two public states produce distinct semantics. |
| One app `loading` boolean disables fields, marks the submit action pending, and displays unresolved content alike. | `APP_REIMPLEMENTATION` + `STATE_OR_VIEWPORT_DRIFT` | Split the business facts and drive each real Common owner. |
| A family paints `isDisabled` and `isPending` identically so progress cannot be distinguished. | `FAMILY_OVERRIDE_GLITCH` + `VALUE_DRIFT` | Restore a distinct pending cue without changing Common semantics. |
| A reusable Common component needs unresolved geometry but exposes no `isSkeleton` path. | `COMMON_CAPABILITY_MISSING` | Add the capability to Common before creating a temporary app workaround. |
| Only class names were inspected; busy state and assistive visibility were not. | `PROOF_MISSING` | Inspect the rendered semantic tree and activation behavior for all three states. |

## CONTROL-STATE-3 — Persistent state has its own value

### When

Peer choices must keep one selection after hover, press, or keyboard focus ends.

### Apply

- Application authority owns the persistent key and passes it through Common `Tabs.selectedKey`;
  `onSelect` requests the next key rather than storing a second DOM-local value.
- Common owns the tab roles, selected semantics, peer keyboard behavior, and `panelId` relationship
  when panels exist. `items` remains the ordered peer inventory.
- Verify selection before and after pointer exit, blur, keyboard movement, rerender, and viewport
  reflow; the visible cue and `aria-selected` must name the same peer.
- A family may paint the selected peer but may not make color the only carrier. App code supplies the
  selected business view and panel content, not tab roles or duplicate state.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| `selectedKey="security"` remains selected after blur and the Security tab controls its declared panel. | `PASS` | One application value drives Common visual and accessible selection. |
| App-authored clickable text keeps its own selected class beside Common tabs. | `APP_REIMPLEMENTATION` + `DOUBLE_OWNER` | Remove the parallel peer control and keep `selectedKey` as the sole value. |
| A family removes every selected cue except a color shift. | `FAMILY_OVERRIDE_GLITCH` + `VALUE_DRIFT` | Restore a persistent non-color distinction while preserving Common tab semantics. |
| Isolated Common output clears selection when focus leaves the tab list. | `COMMON_IMPLEMENTATION_GLITCH` + `STATE_OR_VIEWPORT_DRIFT` | Repair the controlled renderer and retest blur and rerender. |
| Selection was tested by pointer only and no panel association was inspected. | `PROOF_MISSING` | Add keyboard, blur, rerender, and semantic-tree evidence. |

## CONTROL-STATE-4 — Evidence and falsifiers

### When

Any control state, transition, viewport, input method, or family changes the rendered treatment.

### Apply

- Execute every reachable control state with its prior state, trigger, next state, owner, callback
  count, and settlement result recorded.
- Inspect native disabled/busy/selected semantics, visible label and cue, focus behavior, geometry,
  and the accessibility tree in isolated Common, selected family, and application output.
- Require disabled callbacks = `0`, extra pending callbacks = `0`, persistent-state loss = `0`, and
  announced skeleton content = `0` where the published skeleton contract hides it.
- Attribute each failure to the layer that introduced it; a family or app failure does not erase an
  independent Common failure, and source assertions without runtime output are not PASS evidence.

### Examples

| Situation | Finding | Why / next action |
| --- | --- | --- |
| All reachable states have matching source, DOM, accessibility, callback, and settlement evidence. | `PASS` | The complete transition matrix has no falsifier. |
| Isolated Common invokes `onPress` from an `isDisabled` button. | `COMMON_IMPLEMENTATION_GLITCH` | Disabled behavior contradicts the Common public contract; repair and rerun interaction tests. |
| An app's document handler fires a second save while the Common button is pending. | `APP_OVERRIDE` + `DOUBLE_OWNER` | Remove the parallel activation owner and keep one Common handler path. |
| A family keeps a skeleton's real copy visible to assistive technology. | `FAMILY_OVERRIDE_GLITCH` + `STATE_OR_VIEWPORT_DRIFT` | Restore the Common skeleton accessibility outcome under the family scope. |
| Default and pending were checked, but unavailable, skeleton, settlement, or blur was omitted. | `PROOF_MISSING` | Complete the required state and transition cells before closure. |
