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

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Replacing a pressable field-like control with an input | The role and keyboard contract change even if the box looks similar | Port the original pressable primitive |
| Replacing a switch with an icon button | Binary state and switch semantics disappear | Port the original switch |
| Recreating a logo approximately | Brand geometry is an asset, not a styling exercise | Copy the original asset |
| Splitting a compound navigation landmark | Hierarchy, sticky ownership and separators change | Preserve the complete landmark structure |
| Choosing a nearby spacing, size, shadow or divider token | The refactor silently becomes a redesign one token at a time | Read and copy the exact source value |
| Approving one state screenshot | Other branches can be structurally different and remain unseen | Verify the complete state matrix |

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
