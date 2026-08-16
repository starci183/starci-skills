# design verification

## Definition

Design verification proves that the implemented page preserves its thesis, semantics, contract
ownership and geometry in the browser. It combines source gates with rendered evidence because
neither can establish correctness alone.

The deciding question: **would a reader, keyboard user, screenshot comparison and accessibility
tree all observe the intended experience in every required state?**

## Rules

**VERIFICATION-1 · Verify the state matrix deliberately.**

Exercise first-load, ready, empty, failed, pending action, partial data, signed-out and relevant
responsive states. Record which states do not apply rather than silently omitting them.

**VERIFICATION-2 · Verify hierarchy at the target viewport before zooming into details.**

At a glance, identify the page thesis, primary action, first information block and path onward. If
the hierarchy is unclear, token-level polishing cannot rescue it.

**VERIFICATION-3 · Compare migration against the real reference.**

Check primitive roles, assets, copy, grouping, layers, spacing, radius, divider behavior, colour,
dark mode, responsive behavior and loading count. A nearby visual result is a redesign unless the
difference is explicitly approved.

**VERIFICATION-4 · Inspect semantics and interaction, not screenshots alone.**

Keyboard focus, roles, switch state, pressable-versus-input behavior, pending controls, links and
overlay mechanics must match their appearance and product intent.

**VERIFICATION-5 · Run code gates after visual proof and before handoff.**

Typecheck, focused tests, full relevant tests, lint and production build bind the implementation.
Passing them does not replace visual proof; failing them means the work is not complete.

**VERIFICATION-6 · Feed discoveries back to the right place.**

A one-off implementation defect is fixed in code. A repeated design judgement may become a design
document. A stable, already-followed and enforceable convention may become canon. Do not turn every
review comment directly into law.

**VERIFICATION-7 · Verify interactions as state families.**

Verify an interaction as a state family, not one screenshot: resting, hover/focus,
selected/expanded, selected-hover/focus and applicable pending/failed states. Record non-applicable
members. Confirm what changes and what must remain invariant, including adjacent detail or content
panels.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Approve one populated desktop screenshot | Most structural failures live in other states | Exercise the declared matrix |
| Use type safety as visual evidence | Types cannot see hierarchy, overflow or wrong primitives | Inspect rendered output and semantics |
| Accept “close enough” in migration | Nearby tokens accumulate into a redesign | Compare exact reference evidence |
| Change canon to excuse a failing implementation | The rule becomes a record of convenience | Fix code or raise a separate evidence-backed proposal |
| Add a rule from one isolated mistake | The instruction tree becomes a defect diary | Promote only stable repeated judgement |
| Approve one interaction state in isolation | Hover, selection or detail can regress when another state takes precedence | Compare the complete applicable state family at one frozen identity |

## Examples

### Two kinds of proof

```
contract tests prove admitted children; browser inspection proves full-width dividers meet the surface edge
```

```
contract tests pass, therefore the joined list is visually correct
```

They differ in one thing: whether the rendered claim is actually observed.
