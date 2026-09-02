# StarCi Core — Field

This file maps the `FIELD-n` rules to the live Core family: one field's label, control, guidance,
validation, requirement, value, and availability as a single owned relationship. `gap` in the last
column means Common publishes no owner for the case.

The one text-field owner is `Input { id, name, label: ReactNode, kind?: "email" | "password" |
"newPassword" | "code" | "text", variant?: "primary" | "secondary", placeholder?, defaultValue?,
value?, hint?, errorMessage?, isError?, isDisabled?, isRequired?, isSkeleton?, revealLabel?,
hideLabel?, revealIcon?, hideIcon?, onValueChange? }`. It renders HeroUI `TextField` composing
`Label`, an optional `Description`, the native `Input`, and an optional `ErrorMessage`. The
one-time-code owner is `OtpInput { id, name, defaultValue?, disabled?, invalid?, describedBy?,
onChange? }`, six HeroUI `InputOTP` slots inside a `HorizontalScrollRegion`.

## FIELD-1 — One owned field stack

One editable value has one visible identity, one control, and one value authority.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | Identity and control | `Input label` → HeroUI `Label`; `id`, `name`, and `kind` → the native input's `id`, `name`, `type`, `autoComplete`, and `inputMode` (`email`, `current-password`, `new-password`, `one-time-code`, or `off`) | Field tokens: `--field-background` → `--starci-core-surface`, `--field-border: transparent`, `--field-foreground` → `--starci-core-foreground`, `--field-placeholder` → `--starci-core-muted`, `--field-radius` → `--starci-core-control-radius` |
| Case 2 | Value authority | Controlled `value` or uncontrolled `defaultValue`, never both; `onValueChange(value)` reports the native change | Inherited unchanged |
| Case 3 | Secret kinds | `password` and `newPassword` add a reveal toggle `button` named by `revealLabel`/`hideLabel`, drawn with `revealIcon`/`hideIcon` or the label text, disabled together with the field | Inherited unchanged |
| Case 4 | The one-time-code field | `gap` — `OtpInput` publishes no `label`, `hint`, or `errorMessage` slot; only `describedBy` links outside text, so its visible identity has no Common owner | Inherited unchanged |

Source: packages/grammar/src/common/renderers.ts → packages/grammar/src/core/primitive/Input/index.tsx; packages/grammar/src/core/OtpInput.tsx; packages/grammar/src/core/styles.css

## FIELD-2 — Helper and error have different jobs

Guidance is prospective; the error is the current failure and its correction.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | Guidance | `hint` → HeroUI `Description`, rendered between the label and the control | Inherited unchanged |
| Case 2 | Current failure | `errorMessage` → HeroUI `ErrorMessage` after the control; the field is invalid when `isError` is true or `errorMessage` is present (`isInvalid={isError \|\| errorMessage != null}`) | Invalid colour resolves through `--danger` → `--starci-core-danger` |
| Case 3 | Vendor names | `isInvalid`, `Description`, and `ErrorMessage` are HeroUI internals; the public names are `hint`, `errorMessage`, and `isError` | Inherited unchanged |
| Case 4 | The one-time-code field | `OtpInput invalid` → HeroUI `isInvalid` and `aria-invalid`; the message itself must be outside and linked through `describedBy` | Inherited unchanged |

Source: packages/grammar/src/core/primitive/Input/index.tsx; packages/grammar/src/core/OtpInput.tsx

## FIELD-3 — Unavailability preserves identity and work

A disabled field keeps its label and its value; unresolved geometry is a different input.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | Editing cannot continue | `isDisabled` → HeroUI `TextField isDisabled`; the reveal toggle takes `disabled`; `label`, `value`/`defaultValue`, and `hint` render unchanged | Inherited unchanged |
| Case 2 | The reason belongs to the field | The existing `hint` slot; there is no `disabledReason` prop and none should be invented locally | Inherited unchanged |
| Case 3 | Initial unresolved content | `isSkeleton` → `data-state="skeleton"` with two HeroUI `Skeleton` blocks (`h-4 w-1/3`, `h-10 w-full`) and no label, control, or message | Inherited unchanged |
| Case 4 | The one-time-code field | `OtpInput disabled` → HeroUI `isDisabled`; `gap` — no skeleton input, so its unresolved geometry has no owner | Inherited unchanged |

Source: packages/grammar/src/core/primitive/Input/index.tsx; packages/grammar/src/core/OtpInput.tsx

## FIELD-4 — Evidence and falsifiers

The field relationship is proved from the rendered tree across every state, not from the props.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | Attributes to capture | `data-component="Input"`, `data-state="skeleton"`, the native `disabled`, `required`, `aria-invalid`, and `aria-describedby` that HeroUI `TextField` derives from `isDisabled`, `isRequired`, `isInvalid`, `Description`, and `ErrorMessage` | Core emits no field attribute of its own |
| Case 2 | States to run | Default, filled, `isRequired`, invalid (`isError` or `errorMessage`), `isDisabled`, `isSkeleton`, and each secret kind revealed and hidden | Inherited unchanged |
| Case 3 | Layer attribution | Isolated Common output, then the Core delta (the field token bindings in `core/styles.css`), then the application delta | The Core field delta is exactly the five `--field-*` bindings |

Source: packages/grammar/src/core/primitive/Input/index.tsx; packages/grammar/src/core/styles.css
