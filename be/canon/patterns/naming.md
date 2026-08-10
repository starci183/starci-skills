# naming

## Definition

A name is the only part of a symbol that reaches a reader who has not opened it. Everything else —
the signature, the body, the tests — costs a file to consult; the name is what they get for free at
every call site, in every import list, in every grep.

So a name here answers one question: **what is this thing, to somebody who does not already know?**
Not what it happens to be implemented with, not which version of a format it was written for, not
which folder it lived in when it was created. Those all change, and a name that encodes one of them
becomes a lie without anything failing.

The test that settles a name: **will it still be true after the next reasonable change?** A name
that has to be renamed when a schema version bumps, a folder moves, or a second caller appears was
never naming the thing — it was describing a moment.

What holds this law is [`sources/be/naming.mjs`](../../../sources/be/naming.mjs).

## Rules

**NAME-1 · The PATH carries the role and the scope; the file names the subject.**

`parsers/content.service.ts` declares `ContentParserService`. `path/content.service.ts` declares
`ContentPathService`. Same file name, different folder, and the class name is the two read together
— which is why a file is not called `content-parser.service.ts`, and why
`mutations/ai/purchase-ai-subscription/` holds a plain `purchase-ai-subscription.module.ts` rather
than `purchase-ai-subscription-single-mutation.module.ts`.

This was checked the hard way. A first version of this rule demanded the file name spell the whole
class, and measured 616 offenders out of 4430 — which is not debt at fourteen percent of a tree, it
is the convention. The law is what the code does.

What the suffix must still agree on is the ROLE: `*.service.ts` declares a `*Service`,
`*.handler.ts` a `*Handler`. A file whose suffix disagrees with its export claims a role it does
not have.

**NAME-2 · A name says what a thing IS, never which version it was built for.**

`isV2`, `IsContentV2Params`, `parseV2Body` — every one of these has to be renamed the day a V3
arrives, and the rename is the easy part. The hard part is that until then, nobody can tell from
the name whether "V2" means the current shape or an old one, so every reader has to go and find out.

Name the property instead. A marker that says the content has been checked is `hasVerifiedMarker`,
and that name survives the version it was introduced for. This is not hypothetical: the V1 parser
this codebase carried was reached through `isV2`, and when V1 died the name was left describing a
fork that no longer exists.

**NAME-3 · A name says what a thing IS, never where it happened to live.**

A helper reading the content mount was called `VolumeService` because the folder was `.volume` at
the time. The folder has been renamed twice since, so for two renames the helper was named after a
path that no longer existed — and the name gave no clue that anything was wrong.

Name the subject, not the address.

**NAME-4 · A name says what a thing IS, never the mechanism it currently uses.**

A tier table called `HARNESS_TIER` and a variable called `currentTier` named the ROUTING MECHANISM
rather than the thing being chosen. When the mechanism went, every name around it was wrong at once
— because none of them had ever said "model".

**NAME-5 · An exported function is a verb phrase with an object.**

`generate` is a bare verb: generate what? `askModel` says. At an import list, a bare verb collides
with every other module's bare verb, and the reader has to look at the path to guess which one this
is — which is the path doing the naming, and NAME-3 says why that fails.

**NAME-6 · A boolean is a question, and the question is about a property that lasts.**

`isX`, `hasX`, `canX`. Not `checkX` (which sounds like it does something) and not `xFlag`. And the
property asked about follows NAME-2: `hasVerifiedMarker`, not `isV2`.

**NAME-7 · A name is not qualified by its first caller.**

`DashboardContentService` dies the day a second surface needs it, and it dies quietly: it keeps
working, and it keeps saying something false. Name the capability.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| A file suffix that disagrees with the export's role | The suffix claims a role the symbol does not have | Match `*.service.ts` to `*Service`, and so on |
| Repeating the folder's role or scope in the file name | The path already says it, so the name is long and says nothing new | Name the subject; let the path carry the rest |
| A version in a name (`isV2`, `V2Params`) | It has to be renamed at V3, and until then nobody can tell if it means current or old | Name the property the version happened to introduce |
| A name taken from the folder it sits in | Folders move; the name then describes an address that no longer exists | Name the subject |
| A name taken from the mechanism it uses | When the mechanism goes, every name around it is wrong at once | Name the thing being chosen or produced |
| A bare-verb export (`generate`, `parse`, `run`) | It collides with every other module's bare verb, so the path ends up doing the naming | A verb plus its object |
| `checkX` for a boolean | It sounds like it performs the check rather than answering it | `isX` / `hasX` / `canX` |
| A name qualified by its first caller | The second caller makes it false, and it keeps working while being false | Name the capability |

## Examples

### The path carries the role

```
parsers/content.service.ts  ->  export class ContentParserService
path/content.service.ts     ->  export class ContentPathService
```

```
parsers/content-parser.service.ts  ->  export class ContentParserService
```

They differ in one thing: whether the word "parser" is said once or twice.

### The version trap

```ts
/** True when the content carries the marker saying an editor has checked it. */
async hasVerifiedMarker(params: ContentLookupParams): Promise<boolean>
```

```ts
// Wrong: the name is about a schema generation, so it says nothing about WHAT is being asked --
// and it needs renaming the day a third shape exists.
async isV2(params: IsContentV2Params): Promise<boolean>
```

They differ in one thing: whether the name survives the next schema.

### The address trap

```ts
/** Reads a doc out of the mounted content repo. */
export const readGitMountDoc = (relDir: string): GitMountDoc => { /* ... */ }
```

```ts
// Wrong: named for `.volume`, which was renamed to `.mount`, which was renamed to `.gitmounts`.
// The helper kept the first name through both, and nothing ever failed to say so.
export const readVolumeDoc = (relDir: string): VolumeDoc => { /* ... */ }
```

They differ in one thing: whether the name is about the content or about a path.

### The bare-verb trap

```ts
import { askModel } from "@tests/helpers/models"
```

```ts
// Wrong: generate what? The import list gives a reader nothing, so they read the path instead --
// and the path is the thing that moves.
import { generate } from "@tests/helpers/models"
```

They differ in one thing: whether the call site says what happens.
