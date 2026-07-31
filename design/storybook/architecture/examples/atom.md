# atom — in a real system

One value, its states, nothing arranged.

The rule is in [`../elements/atom.md`](../elements/atom.md). This is one system obeying it,
named so every row can be checked.

Nine families, grouped by **what kind of value** — never by feature. There is no `checkout` family
and no `course` family: the moment a folder here is named after something the product does, the
tier is broken.

## text · display

| Component | Renders | Why this tier |
|---|---|---|
| `Typography` | a string at a scale, in a tone, with its own skeleton | one value; internals are a table of scales to line-box heights |
| `Badge` | a small count or status pip | renders a value, places no child |
| `Divider` | a rule between things | renders one element; the *caller* decides where |
| `Avatar` | one person's face, with a fallback chain | one value — an image or its stand-in |
| `UserCell` | a face beside a name | borderline: two values in a fixed pairing, no arrangement offered |
| `Logo` | the brand mark | one value, and exactly one colour — no variants to pick |
| `PricePoint` | an amount, its original, its period | one formatted value, no currency logic |
| `IconTile` | an icon in a tinted square | one value plus its own chrome |
| `Progress` | a bare progress track | one number; the *labelled* version is a composite |
| `Spinner` | a busy indicator | no value at all — pure state |
| `StepBadge` | a step number in a ring | one value with a state (done, current, ahead) |
| `ThreadConnector` | the line joining threaded items | renders chrome only |
| `SnippetIcon` | a language glyph for a code snippet | maps one value to one glyph |

## forms · buttons · chips

| Component | Renders | Why this tier |
|---|---|---|
| `Input` | a text field with label, hint, error, required | carries its own label — there is no wrapper tier above it |
| `Select` | a closed-set picker | same contract as `Input` |
| `Choice` | radio, checkbox, switch | one value and its checked state |
| `SearchAutocomplete` | a field that suggests as you type | still one value; the suggestions are data passed in |
| `Dropzone` · `ImageDropzone` | a drop target and its pending state | one value — the file — plus its states |
| `Button` | a pressable label, optionally with an icon | renders a value; the *group* of buttons is a composite |
| `Chip` | a short label as a pill | one value; the mapped version is a composite |

## navigation · overlay · media · feedback

| Component | Renders | Why this tier |
|---|---|---|
| `Link` | an anchor in house style | one value plus a destination |
| `Tabs` | the tab primitive | renders the control; who owns which panel is decided above |
| `Accordion` | the disclosure primitive | renders open/closed state of one region |
| `Breadcrumbs` | an ancestor chain | an array of one shape, no domain |
| `Pagination` | page numbers | a number and a total |
| `Popover` · `Tooltip` · `Menu` · `Toast` | the floating surface itself | chrome only — the content is handed in |
| `Image` · `CoverImage` · `QRCode` | an image, a framed image, a code | one value each |
| `Alert` | a message with a tone | one value plus its severity |
| `ReactionPicker` | a row of reaction glyphs | a closed set of values, no entity |

## The vendor line

Where a `Base` file sits beside a plain name — `ChipBase` beside `Chip` — the `Base` holds the
vendor import and the plain name is the house version with the vendor's freedom removed. Everything
above talks to the plain name, so the library underneath can be swapped in one file.

Most atoms touch the vendor. That is the wrapping layer being the wrapping layer, not a leak.

---

Read from a live tree with `scripts/scan-storybook-architecture.mjs`. Another repo answers with
different names, and its answer outranks this file.
