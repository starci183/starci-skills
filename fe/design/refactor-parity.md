# refactor parity

## Definition

Refactor parity means ownership may change while the reader's interface does not. The reference
implementation fixes both appearance and interaction semantics: what looks like a field, what is
actually pressable, what is a switch, which rows share one surface, and which layers form one
navigation landmark.

The question that settles it: **would a reader, keyboard user, screenshot test or accessibility
tree observe a different interface?** If yes, it is a redesign, not a refactor.

## Rules

**REFACTOR-PARITY-1 · Copy the reference before translating it into the new architecture.**

Inspect the real component, asset and computed style first. Memory and screenshots hide semantic
primitive choice, nested layers and state-dependent tokens; copying from either produces a nearby
interface rather than the same one.

**REFACTOR-PARITY-2 · Semantic primitive parity is part of visual parity.**

A pressable field-like control is not an input, and a switch is not an icon button even when their
resting screenshots can be made similar. Behaviour, focus, role and state are part of the shape.

**REFACTOR-PARITY-3 · Compound landmarks remain compound.**

A primary navigation row and its tab row are one double-layer landmark when the reference makes
them one. Rendering the same labels as two unrelated regions changes hierarchy, sticky behaviour
and separators even if each row looks plausible alone.

**REFACTOR-PARITY-4 · Exact assets and tokens survive the fork.**

Logo artwork, icon identity and size, border or shadow choice, separator thickness and inset,
spacing, radius, loading count, dark state and responsive state are evidence, not suggestions. A
nearby token is a new decision and therefore outside a refactor.

**REFACTOR-PARITY-5 · Verification covers the state matrix, not one screenshot.**

Signed out, signed in, loading, empty, populated, light, dark and responsive states expose
different branches of the same component. Preserving only the easiest state leaves the migration
untested where it differs most.

**REFACTOR-PARITY-6 · Architecture translation does not license visual invention.**

The legacy source decides the initial render, content grouping and state branches. The new layer
model decides where that same behavior belongs and how its types are enforced. New icons, cards,
copy, states or interactions wait for an explicit redesign request; they are not improvements made
while porting.

**REFACTOR-PARITY-7 · Selection changes state, not peer geometry.**

Selected and unselected options in one selector use the same primitive, font size, line height and
target geometry; only state tokens and state attributes change. The available option list is owned
independently of the current selection. Deriving recent years from the selected year makes an old
choice erase the route back to the present, which is a behavior change rather than a styling bug.

**REFACTOR-PARITY-8 · Port the reference's overflow interaction, not a browser substitute.**

When the reference uses a constrained draggable track inside an `overflow-hidden` viewport, port
that interaction as-is. A visible native scrollbar is not an equivalent rendering: it changes both
the geometry and the interaction the reader was given. Any accessibility improvement is a separate,
explicit product change; do not silently mix it into a parity refactor.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Replacing a pressable field-like control with an input | The role and keyboard contract change even if the box looks similar | Port the original pressable primitive |
| Replacing a switch with an icon button | Binary state and switch semantics disappear | Port the original switch |
| Recreating a logo approximately | Brand geometry is an asset, not a styling exercise | Copy the original asset |
| Splitting a compound navigation landmark | Hierarchy, sticky ownership and separators change | Preserve the complete landmark structure |
| Choosing a nearby spacing, size, shadow or divider token | The refactor silently becomes a redesign one token at a time | Read and copy the exact source value |
| Approving one state screenshot | Other branches can be structurally different and remain unseen | Verify the complete state matrix |
| Adding helpful-looking UI absent from the reference | The migration silently changes product behavior or visual hierarchy | Port the reference first; propose redesigns separately |
| Rendering the selected option with a different text primitive or size | State changes the selector's geometry and reading rhythm | Use one peer primitive and vary only semantic state tokens |
| Deriving the option list from the selected option | Choosing an old value can remove the way back | Derive stable choices from their domain anchor, such as the current year |

## Examples

### A field look is not a field role

```tsx
<PressableInputLike props={{ placeholder, shortcut }} on={{ press: openSearch }} />
```

```tsx
<Input props={{ placeholder }} on={{ change: search }} />
```

They differ in one thing: whether the reference control opens search or edits text in place.

### One landmark, two layers

```tsx
<Tree contract="double-navbar" render={navbarWithPrimaryAndBottomTabs} />
```

```tsx
<Navbar />
<Tabs />
```

They differ in one thing: whether the two rows still share one landmark and one boundary.

### Exact token evidence

```tsx
<Icon props={{ name: "search", size: "md" }} />
```

```tsx
<Icon props={{ name: "search", size: "sm" }} />
```

They differ in one thing: whether the refactor preserved the measured reference size.
