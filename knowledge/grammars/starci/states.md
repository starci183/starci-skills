# StarCi Core fields, actions, states, focus, and motion

## Fields

Business code supplies label, value, hint/error, validity, disabled state, and change effects to Common `Input` or `OtpInput`. Core supplies scoped field material; it never infers validation. Bindings: [FIELD-1..4](field.md), [FEEDBACK-1](../../ui/composition/feedback.md), and [A11Y-1](../../ui/proof/accessibility.md).

```tsx
<Input
  id="email"
  name="email"
  label="Email"
  value={email}
  errorMessage={error}
  isError={error !== undefined}
  onValueChange={setEmail}
/>
```

Expected Core render: one field stack with stable label, description/error relationship, theme-correct material, and no app-authored ARIA or CSS.

## Destination versus command

Bindings: [ACTION-1..4](../../ui/composition/action.md), [STATE-1](../../ui/composition/state.md), and [CONTROL-STATE-1..2](control-state.md).

```tsx
<TextAction href="/courses/foundations">View course</TextAction>
<TextAction onPress={openFilters}>Filters</TextAction>
<Button type="submit" isPending={saving}>Save</Button>
```

`TextAction` and `Button` take `href` for a destination and `onPress` for a command; the type forbids both on one element, so shared styling never collapses those semantics. Pending stays on the initiator, preserves the label, blocks duplicates, and settles from application truth.

## Presentation states

Common owns `neutral | informative | affirmative | cautionary | negative | pending | unavailable`, its guards, and state-capable props. Core maps visible tone/material without inventing facts. Bindings: [STATE-1..4](../../ui/composition/state.md), [TRUTH-1..4](../../ui/proof/render-truth.md).

Use `EmptyNotice` only after feature authority resolves empty/failure/unavailable truth. Use `Progress` only for named measurable progress; zero is not failure and skeleton is not progress.

## Focus and accessibility

Core preserves Common native DOM, labels, controlled selection, and focus-visible treatment. `Tooltip` is supplementary only. General modal focus containment/restoration remains a Common gap. Bindings: [A11Y-1..4](../../ui/proof/accessibility.md), [FOCUS-1..4](../../ui/proof/focus.md), and [ICON-5..6](icon.md).

## Motion

Core binds family motion duration/easing and honors reduced motion. Motion may communicate transition or spatial continuity; it never carries unique truth, changes DOM order, or delays operability. Bindings: [MOTION-1..4](../../ui/proof/motion.md).
