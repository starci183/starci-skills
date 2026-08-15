# icon

## Definition

An icon is a closed product meaning drawn through the Heroicons vocabulary. The caller names what
the glyph MEANS and the role it performs; the icon leaf alone selects the concrete SVG.

The question that classifies its role is: **is it introducing content, leading an ordinary control
or row, or sitting inside a compact chip?** A heading icon is not a leading icon made larger, and a
chip icon is not either one made smaller. Heroicons authored separate drawings for those jobs.

What holds this law is [`sources/fe/icon.mjs`](../../../sources/fe/icon.mjs). TypeScript closes the
meaning and role unions; lint closes the two escapes types cannot see: importing a glyph package at
a call site, and changing the vendor from inside the icon leaf.

Implementation anchors in `starci-academy-fe`: `src/components/leaves/Icon/index.tsx` and
`src/components/leaves/Icon/icon.md`.

## Rules

**ICON-1 · An icon has exactly three semantic roles.**

`heading` is a Heroicons 24 outline glyph at `size-6`. `leading` is the same outline vocabulary at
`size-5`, for navigation, list rows, fields and ordinary icon controls. `chip` is the native
Heroicons 16 solid micro glyph at `size-4`. These are role names, not styling choices; a caller does
not pass pixels, Tailwind size classes or an arbitrary weight.

**ICON-2 · A heading icon is 24 outline at size six.**

A heading needs the open 24-pixel drawing because it introduces a region without becoming a badge.
Using mini or micro artwork there changes both its geometry and visual weight, even when CSS grows
the final box to the same measurement.

**ICON-3 · A leading icon is outline at size five.**

Navigation tabs, list rows, fields, switches and icon controls use the outline vocabulary at 20px.
They lead words or an ordinary interaction; they do not claim the weight of a heading and are not
compressed into a chip.

**ICON-4 · A chip icon is the native 16 solid micro drawing.**

A chip is compact and already supplies its own enclosing shape. Its icon therefore comes from
`@heroicons/react/16/solid` at `size-4`; scaling a 24 outline glyph down is not equivalent because
the paths were drawn for a different optical size.

**ICON-5 · A glyph inherits colour.**

The glyph draws in `currentColor`, so disabled, muted, selected and themed states remain one state
with the words around it. Exact provider and house marks may keep their authored colours because
recolouring them changes their identity.

**ICON-6 · Callers name meanings, never vendor components.**

Only `src/components/leaves/Icon/index.tsx` may import a glyph library. A sibling such as
`brands.tsx` owns exact local SVG paths, not another route into Heroicons. A caller importing an SVG component
chooses vendor, picture, family and size locally, creating a second icon vocabulary outside the
closed map.

**ICON-7 · Heroicons is the only glyph vendor.**

The icon leaf may import `@heroicons/react/24/outline` and `@heroicons/react/16/solid`. Phosphor,
Lucide, React Icons, Tabler and Font Awesome are refused even inside that folder. Exact brand SVGs
remain local assets rather than approximations selected from another general-purpose package.

**ICON-8 · A glyph never shrinks.**

Every role carries `shrink-0`. When a row becomes tight, words wrap or clip first; deforming the
glyph makes the row hardest to recognise at the exact point it is hardest to read.

**ICON-9 · The source feature map owns meaning-to-glyph selection.**

`src/components/leaves/Icon/icon.md` maps every `IconName` to one product feature and one concrete
Heroicon. The same feature reuses its meaning in every placement; different meanings do not share
a glyph merely because it is nearby or visually plausible. `IconName`, `GLYPHS` and the table move
together, and source parity tests reject a missing row, a stale component name or duplicate glyph
ownership.

**ICON-10 · Compact business facts do not gain decorative feature icons.**

A compact metric, goal, kind label, streak caption or fact cell whose reference is text-only
remains text-only. Tiny inline glyphs are reserved for generic state and action meanings that the
reference actually carries - for example complete, failed, pending, close or disclosure. A book
beside `Content` or a flame beside a streak count repeats meaning the words already closed; adding
it creates a second visual index, increases noise and turns a refactor into a redesign. Navigation,
named feature entry points and large empty-region headings keep their reference icons because the
glyph is part of locating or identifying that region there.

**ICON-11 · Every IconTile contains a size-five leading glyph.**

An IconTile may use a small or medium plate, but its glyph is always the Heroicons 24 outline
`leading` role at `size-5`. Plate size changes the breathing room and emphasis of the surface; it
does not promote the glyph to heading `size-6` or compress it to chip `size-4`. `IconTile` owns this
choice, so callers never derive glyph role from tile size.

**ICON-12 · A leading icon must distinguish peers.**

A regular leading icon belongs in a set of heterogeneous peer choices or destinations - such as a
list, menu, tabs or navigation - where the reader can identify one item before reading its label.
A lone summary or header row already named by its section has no peer identity to distinguish, so
repeating that concept as a glyph is decoration. Render its primary label normally and its trailing
supporting fact as `text-xs muted`.

**ICON-13 · Product reactions use the checked-in Fluent Emoji artwork.**

Reactions are expressive product artwork, not semantic interface glyphs. The reaction leaf owns the
fixed `like`, `love`, `haha`, `wow`, `sad`, `angry` map to the Flat SVGs checked in under
`public/reactions/`, and the Microsoft Fluent Emoji MIT attribution travels with those assets.
Callers pass only the reaction identity and resolved label. They do not pass Unicode emoji, asset
paths, arbitrary images or vendor components. This is a narrow artwork boundary; Heroicons remains
the only vocabulary for navigation, state and action glyphs.

The canon mirrors that operational table below so an AI reading `.claude` has the selection answer
before it opens the product source. A mapping change updates this table and the source table in the
same logical change.

| Meaning (`IconName`) | Product feature | Heroicon |
|---|---|---|
| `brand` | Academy/learning identity | `AcademicCapIcon` |
| `streak` | Learning streak | `FireIcon` |
| `credit` | AI credit/quota | `BoltIcon` |
| `reward` | Rewards and gift points | `GiftIcon` |
| `course` | Courses and content | `BookOpenIcon` |
| `email` | Email identity | `EnvelopeIcon` |
| `password` | Password field | `LockClosedIcon` |
| `revealPassword` | Reveal a masked password | `EyeIcon` |
| `hidePassword` | Hide a visible password | `EyeSlashIcon` |
| `code` | Verification/security code | `ShieldCheckIcon` |
| `complete` | Completed/successful state | `CheckCircleIcon` |
| `pending` | Incomplete/pending progress | `CircleIcon` derived from the outer path of `CheckCircleIcon`; remove only the inner check |
| `signIn` | Enter account/session | `ArrowRightOnRectangleIcon` |
| `signUp` | Create account/session | `UserPlusIcon` |
| `close` | Dismiss/close | `XMarkIcon` |
| `next` | Continue/go forward | `ArrowRightIcon` |
| `disclosure` | Open the details/profile named by this row | `ChevronRightIcon` |
| `retry` | Retry/refresh failed work | `ArrowPathIcon` |
| `send` | Send/submit message | `PaperAirplaneIcon` |
| `home` | Dashboard overview | `HomeIcon` |
| `explore` | Explore/discover catalogue | `GlobeAltIcon` |
| `community` | Learner community | `UserGroupIcon` |
| `league` | Leaderboard and competition | `TrophyIcon` |
| `review` | Review assigned work | `ClipboardDocumentCheckIcon` |
| `light` | Light theme | `SunIcon` |
| `dark` | Dark theme | `MoonIcon` |
| `locale` | Language/locale switch | `LanguageIcon` |
| `google` | Google provider | `GoogleMark` |
| `github` | GitHub provider | `GithubMark` |
| `search` | Global search | `MagnifyingGlassIcon` |
| `cart` | Shopping cart | `ShoppingCartIcon` |
| `notification` | Notifications | `BellIcon` |
| `account` | Current user account | `UserCircleIcon` |
| `profile` | Current learner profile | `UserIcon` |
| `cv` | Learner CV | `DocumentTextIcon` |
| `settings` | Account/profile settings | `Cog6ToothIcon` |
| `signOut` | End the current session | `ArrowLeftStartOnRectangleIcon` |
| `saved` | Saved/bookmarked content | `BookmarkIcon` |
| `blog` | Blog/editorial content | `NewspaperIcon` |
| `talents` | Talent discovery | `SparklesIcon` |
| `jobs` | IT jobs | `BriefcaseIcon` |
| `practice` | Programming/code practice | `CodeBracketIcon` |

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Import Phosphor or another glyph package | It opens a second visual language | Map the meaning to Heroicons in the icon leaf |
| Import Heroicons outside the icon leaf | Vendor, glyph, family and size escape to the call site | Pass an `IconName` and semantic role |
| Grow micro artwork into a heading | CSS size cannot restore geometry authored for another optical size | Use 24 outline at `size-6` |
| Change an IconTile glyph with its plate size | The same semantic mark jumps between chip, leading and heading weight | Keep every IconTile glyph at leading `size-5`; vary only the plate |
| Shrink 24 outline artwork into a chip | It is not the native micro drawing | Use 16 solid at `size-4` |
| Use `mini` for a chip | Mini is 20px; the product chip role is micro | Use `@heroicons/react/16/solid` |
| Pass a raw size, class or weight | The caller silently creates another role | Choose `heading`, `leading` or `chip` |
| Give a product glyph its own colour | It contradicts the state carried by its container | Inherit `currentColor` |
| Let a glyph shrink in a flex row | Its geometry collapses under pressure | Keep `shrink-0`; let words give way |
| Reuse one glyph for unrelated features | Readers cannot distinguish the destinations and later authors copy the ambiguity | Add a unique feature row to the source map |
| Add a feature icon to a compact business fact | The words already close the meaning, so the glyph adds noise and diverges from a text-only reference | Keep metrics, kinds, goals and captions textual; use tiny glyphs only for reference-backed generic state/action semantics |
| Put a leading icon on a lone summary or header row | There are no peer identities for the glyph to distinguish, and the section title already supplies the concept | Render the label and its smaller muted trailing fact without an icon |
| Render reactions as Unicode emoji | Platform fonts change the artwork and break parity with the legacy product | Use the six checked-in Fluent Emoji Flat SVGs through the reaction leaf |
| Pass a reaction image or asset path from a caller | The fixed product vocabulary leaks into every feed row | Pass the semantic reaction identity; let the reaction leaf own its asset map |
| Import Fluent Emoji as a glyph catalogue | Reaction artwork becomes an ad-hoc second icon vendor | Keep the attributed SVG subset in `public/reactions/`; Heroicons remains the glyph vendor |
| Change `GLYPHS` without changing the source table | Code and AI guidance immediately disagree | Update `icon.md`, `IconName` and `GLYPHS` together |

## Examples

### Heading family

```tsx
<Icon props={{ name: "course", role: "heading" }} />
```

```tsx
<BookOpenIcon className="size-6" />
```

They differ in one thing: the first selects the 24 outline drawing through the closed meaning map;
the second leaks the vendor component to the caller.

### Chip family

```tsx
<Icon props={{ name: "close", role: "chip" }} />
```

```tsx
<XMarkIcon className="size-4" />
```

They differ in one thing: the first selects the native 16 solid micro drawing; the second leaves
the family ambiguous even though its final CSS box happens to be 16px.

### Leading versus heading

```tsx
<Icon props={{ name: "home", role: "leading" }} />
```

```tsx
<Icon props={{ name: "home", role: "heading" }} />
```

They differ in one thing: whether the icon leads an ordinary navigation row or introduces a
heading region.

### Brand boundary

```tsx
<Icon props={{ name: "google", role: "chip" }} />
```

```tsx
<SomeGenericGoogleIcon className="size-4" />
```

They differ in one thing: the first preserves the exact provider SVG; the second substitutes a
general-purpose glyph for an identity mark.
