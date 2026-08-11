# translation

## Definition

Copy is data. It arrives from a dictionary, it changes without a deploy, it differs per reader — and
like every other piece of data in this system, it is resolved by the half that owns the request and
handed down already decided.

That has one consequence worth stating plainly, because it is the rule people reach past: **no
component below a block ever says a word of its own.** A leaf renders the string it was given. A
composite arranges strings it was given. Neither knows which language it is in, and neither can be
made wrong by a translation landing late.

The question that settles it: **would a reader in another language see something different here?**
If yes, it is copy, and copy is resolved one file away.

What holds this law is [`sources/fe/translation.mjs`](../../../sources/fe/translation.mjs), plus the
split rule that keeps the drawing half from reaching for the runtime at all.

## Rules

**COPY-1 · The connected half resolves every word.**

The block that owns the request owns the words that describe its answer, because only it knows which
situation the reader is in and therefore which sentence is true. Everything below receives strings.

**COPY-2 · A component below a block holds no literal a reader can see.**

Not in a label, not in a placeholder, not in an aria-label, not in a title attribute. Those four are
where copy hides most often, because none of them looks like a sentence in the markup — and a reader
using a screen reader hears the aria-label as the primary text, so an English one in a Vietnamese
surface is not a small defect.

**COPY-3 · A key never crosses the line.**

Passing `labelKey="quest.title"` moves the lookup rather than the decision, and now the drawing half
needs the whole translation runtime to be rendered from a fixture. The string crosses, not the key.

**COPY-4 · A resolved string is a value, so it obeys the data fence.**

It travels in `props` like any other value. That is what lets a component be rendered from a fixture
with the word `"anything"` and still be correct.

**COPY-5 · The dictionary is the other language, so it is not source.**

A file under the locale folders is content, not authoring, and the English-only rule does not reach
it. That is the one exemption, and it is a path rather than a judgement, because a judgement-based
one would be argued per file forever.

**COPY-6 · A word the program MATCHES on is not copy.**

A status the server sends and the screen compares against is a value, and translating it breaks the
comparison. It stays as it is, marked on its line with the reason — the mark is what tells the next
reader it was a decision rather than something somebody forgot.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| A translation call below a block | The component needs the runtime to be rendered, so it cannot be tested from a fixture | Resolve it in the connected half |
| Reading the current locale to pick a word | Same dependency, one level quieter | Same |
| A visible literal in a leaf or composite | It is copy, and one reader in another language sees English | Take the resolved string through `props` |
| A literal in `aria-label`, `placeholder`, `title` or `alt` | It does not look like a sentence, and a screen reader treats it as the primary text | Same |
| A translation KEY passed down | It moves the lookup, not the decision, and drags the runtime with it | Pass the resolved string |
| Translating a value the program matches on | The comparison breaks, and the failure is silent | Keep it, and mark the line with why |
| Applying the English-only rule to a dictionary | The dictionary IS the other language | Leave locale content alone |

## Examples

### Where the word is chosen

```tsx
// index.tsx: the half that knows which situation this is knows which sentence is true
return <_DailyQuest state="failed" props={{ label: t("label"), message: t("failed") }} />
```

```tsx
// component.tsx: it would have to know the situation AND the dictionary
const t = useTranslations("quest")
return <SurfaceCard props={{ label: t("label") }} contract="quest-rows" render={questRows} />
```

They differ in one thing: whether the drawing half can be rendered without the runtime.

### The literal that does not look like one

```tsx
<Icon props={{ name: "search" }} />
<Input props={{ placeholder: props.searchPlaceholder }} />
```

```tsx
<Input props={{ placeholder: "Search courses" }} />
```

They differ in one thing: what a reader in another language sees — and with an `aria-label`, what a
screen reader says.

### The value that is not copy

```ts
// vn-ok: the server sends this status verbatim and the screen matches on it
const CANCELLED = "Da huy"
```

```ts
const CANCELLED = t("status.cancelled")
```

They differ in one thing: whether the comparison still works after the dictionary changes.
