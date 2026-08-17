---
title: Naming
description: Where an accepted shape lands in source, and what each declared name must say once it lands.
module: naming
kind: pattern
stack: be
codes: [NAME-1, NAME-2, NAME-3, NAME-4, NAME-5, NAME-6, NAME-7]
---

# Naming

The input is a shape somebody already accepted — a capability, an operation, a contract, a helper that
the design decided exists. This pattern does not re-open that decision. Its output is source
architecture: which folder holds the symbol, which file it goes in, what suffix that file carries, and
what the declared symbol is called once it is there. A name is the only part of a symbol that reaches
a reader who has not opened it, so landing a shape badly is not a cosmetic loss — it is the shape
lying at every call site.

## Law

A name is the only part of a symbol that reaches a reader who has not opened it. The signature, the
body and the tests all cost a file to consult; the name is what a reader gets for free at every call
site, in every import list, in every grep.

So a name answers one question: **what is this thing, to somebody who does not already know?** Not
what it is implemented with, not which shape of a format it was written for, not which folder it
lived in when it was created. All three of those change, and a name that encodes one of them becomes
a lie without anything failing.

The test that settles a name: **will it still be true after the next reasonable change?** A name
that must be renamed when a schema generation bumps, a folder moves, a mechanism is swapped or a
second caller appears was never naming the thing — it was describing a moment.

**This is binding, not advisory.** Every exported symbol, every file and every boolean sits under
exactly one of the codes below. There is no symbol too small to carry one: a private folder-local
helper answers `NAME-5` for the same reason a public service class answers `NAME-1`. "It is only a
local name" is where this rule is skipped most often, and a local name is exactly the one that gets
exported six months later without being re-read.

Most of this law is not machine-checkable, and that is why it is written with the scars attached.
Two of the seven codes have a lint rule behind them; the other five have only a reader.

## Situation codes

Every situation this module governs carries a code, `NAME-<n>`. The numbers are FIXED: they are
cited from sibling laws and from historical task records, so a renumber silently breaks a citation
somebody already made.

| Code | Situation | What the source must look like |
|---|---|---|
| `NAME-1` | Path already carries the role and the scope; the file has only the subject left to name | The path carries the role and the scope; the file names the subject; the declared symbol is the two read together, and the file suffix agrees with the export's role (`*.service.ts` declares a `*Service`, `*.handler.ts` a `*Handler`). Forbidden: repeating the folder's role or scope inside the file name; a suffix that claims a role the export does not have |
| `NAME-2` | There is a second schema generation, and the name is talking about that generation | The name states the property, so it survives the generation that introduced it. Forbidden: a schema generation baked into an identifier (`isV2`, `V2Params`, `parseV2Body`) |
| `NAME-3` | The thing sits behind a directory, mount or bucket that has a name | The name states the subject. Forbidden: a name taken from the directory, mount, bucket or path the thing currently sits behind |
| `NAME-4` | The thing is currently produced by a named mechanism | The name states the thing being chosen, produced or measured. Forbidden: a name taken from the mechanism that currently produces it |
| `NAME-5` | A function is exported out of its file | An exported function is a verb plus its object. Forbidden: a bare-verb export (`generate`, `parse`, `run`) that forces the reader back to the path |
| `NAME-6` | A boolean value | A boolean is a question — `isX`, `hasX`, `canX` — about a property that lasts. Forbidden: `checkX`, which reads as performing the check; `xFlag`, which names nothing; a question about a generation rather than a property |
| `NAME-7` | A shared capability that currently has exactly one caller | The name states the capability. Forbidden: a name qualified by whichever surface asked for it first |

Seven codes, and it ends at seven. A situation that genuinely has no code is a recorded rule change,
not an eighth number added in passing.

`NAME-2`, `NAME-3` and `NAME-4` are one sentence said three times against three different tempting
substitutes, and they stay three codes because the substitutes fail differently: a version is wrong
on a schedule, a path is wrong the day somebody else runs a rename, and a mechanism is wrong all at
once, taking every neighbouring name with it.

## Reading an accepted shape

1. **Read what the shape states.** It states the subject — the capability, the operation, the value
   being computed. It states the role: service, handler, resolver, module, util, constant, predicate.
   It states the scope the symbol lives under. Those three are the inputs the name is built from.
2. **Read what the shape does not state, and refuse to resolve it.** An accepted shape does not state
   which schema generation the payload happens to be on, which mount the data currently sits behind,
   which mechanism currently produces the value, or which surface will call it second. Those four are
   exactly the substitutes `NAME-2`, `NAME-3`, `NAME-4` and `NAME-7` refuse. If the shape is silent
   on them, the name stays silent on them too — a fact the shape does not state cannot be encoded in
   a name that outlives it.
3. **Resolve outermost first.** Folder before file, file before symbol, symbol before member. The
   folder decides role and scope, so the file only adds the subject (`NAME-1`); once the file suffix
   is fixed it constrains the export's role, and only then does the declared identifier get chosen.
   Resolving the identifier first is how a folder word gets said twice.
4. **Ask each code's question in turn.** `NAME-1`: is this word already in the path? `NAME-2`: the
   day there is a third generation, must this name change — and until then, what does it say?
   `NAME-3`: if the storage location is renamed tomorrow, is this name still true, and who finds out?
   `NAME-4`: if the mechanism is replaced and the result kept, is this name still true? `NAME-5`:
   generate **what**? `NAME-6`: does this read as a yes/no question, and is the question about a
   property or about a generation? `NAME-7`: if a second surface needs exactly this tomorrow, does
   the name become wrong, and does anything report it?
5. **When two codes both match, the subject of the fault decides.** `isV2` is wrong twice: it is a
   boolean, so `NAME-6` matches, and it asks about a schema generation, so `NAME-2` matches. Record
   `NAME-2` — what is broken is the subject of the question, not the shape of the sentence. The same
   ordering runs elsewhere: a bad word inside the name outranks a bad form of the name.

## `NAME-1` — path carries role, file names the subject

**Situation.** The symbol sits in a directory tree that already says what kind of thing it is and
what scope it belongs to. The class name is the folder and the file read as one phrase; the file does
not repeat the part the folder already said. Alongside that, the file suffix must agree with the role
of the export: `*.service.ts` declares a `*Service`, `*.handler.ts` declares a `*Handler`.

**What it emits in source.** A folder that carries role and scope, a file whose name adds only the
subject, a suffix matching the export's role, and one declared symbol that is folder plus file read
together.

**Recognition signs.** Reading `folder/file` as one phrase produces exactly the class name. Deleting
a word from the file name loses no information — that word is being said twice. A suffix promises one
role and the file exports another.

**Boundary.** Not `NAME-3`: `NAME-1` says a path is **allowed** to contribute to a name, while
`NAME-3` forbids taking a physical address — mount, bucket, infrastructure directory — as a name. A
classifying path contributes; a storage path does not. Not `NAME-7`: a surface-shaped folder (one
operation of one screen) is a legitimate scope for that **operation**, not a licence to name a shared
service after a surface.

Checked history: an early version of this law demanded the file name spell out the whole class name,
and measured **616 violations across 4430 files**. Fourteen per cent of a source tree is not debt, it
is the **convention**. The law records what the source actually does; a rule that measures wrong at
that scale is the wrong rule.

**Common business situations.** A `path/` and a `parsers/` folder each holding a file with an
identical name · one operation folder holding command, handler, resolver and module · one integration
folder holding client, producer and consumer · an `errors/<scope>/` folder holding one exception each.

## `NAME-2` — the name states the thing, not the schema generation

**Situation.** There is a second shape of the same thing, and the author took the **generation
number** as the name: `isV2`, `IsContentV2Params`, `parseV2Body`.

**What it emits in source.** An identifier naming the property that generation introduced — the thing
that is actually true of the value — so the identifier survives the generation that prompted it.

**Recognition signs.** A `V` followed by a digit inside the name. Right next to that name, the
expression is reading a real property (`Boolean(record.verified)`). Nobody can answer "is V2 the
**current** generation or the **old** one?" without opening the file.

**Boundary.** Not `NAME-6`: `isV2` is wrong twice — it is a boolean, so `NAME-6` matches, and it asks
about a schema generation, so `NAME-2` matches. Record `NAME-2`, because what is broken is the
**subject of the question**, not the form of the sentence. Not the exception either: a `schemaVersion`
column, a `/v1/` segment in a public path, a migration class carrying an ordinal — those name a
version as **data**, not a branch named after a version.

The real cost is not the rename on the day V3 lands; renaming is the easy part. The expensive part is
**every day until then**, when each reader must go and look up whether "V2" means current or dead.

**Common business situations.** A parser reading two content formats · a prompt input with two
generations · a webhook payload that changed shape · old and new API DTOs living side by side · a
branch flag inside a step service.

## `NAME-3` — the name states the thing, not the address

**Situation.** The thing reads data out of a named directory, mount or bucket, and the author took
the **name of the location** as the name: `VolumeService`, `readVolumeDoc`.

**What it emits in source.** An identifier naming the document, record or subject being read, with
the storage location appearing only in the path constant it resolves — never in the exported name.

**Recognition signs.** The name contains a directory, a mount, a bucket or an infrastructure prefix.
Renaming the storage location makes the name wrong immediately, and **no test goes red**. A newcomer
reading the name still finds it reasonable — which is precisely the danger.

**Boundary.** Not `NAME-1`: a **classifying** path (`parsers/`, `path/`) is a role and may contribute
to the name; a **storage** path (`.volume`, `.mount`) is an address and may not. Not `NAME-4`: an
address is **where the thing sits**; a mechanism is **how the thing is produced**. They fail the same
way for different reasons.

The scar: a helper reading mount content was called `VolumeService` because the directory was
`.volume` at the time. That directory has been renamed **twice** since. Across both renames the
helper carried the name of a path that no longer existed, and nothing reported it. Worse, the broken
path constant only made the suite **skip**, so the lane stayed green while running nothing.

**Common business situations.** A helper reading the content mount · a service reading seed files · an
adapter reading object storage · a util reading a snapshot directory · a loader reading a migration
directory.

## `NAME-4` — the name states the thing, not the mechanism

**Situation.** The thing is currently chosen or produced by a named mechanism — a ranking table, a
fallback chain, a routing algorithm — and the author took the **mechanism's name** as the name.

**What it emits in source.** An identifier naming what is chosen, produced or measured — a model
weight, the credit a typical call costs — so the mechanism can be replaced without invalidating the
name.

**Recognition signs.** The name describes how the choosing happens, not **what is chosen**. Reading
the whole cluster of surrounding identifiers, none of them says what the final **thing** is. Remove
the mechanism and **the entire cluster of names goes wrong at once**.

**Boundary.** Not `NAME-3`: see above — address versus production. Not the exception: an integration
module whose **whole job is** one external system may carry that system's name, because there the
mechanism **is** the subject. What is refused is naming a **business capability** after the
infrastructure it currently rides.

Why this code is heavier than it looks: `NAME-2` and `NAME-3` are wrong **one name at a time**.
`NAME-4` is wrong across **a whole region**: when the mechanism disappears, every name around it is
wrong simultaneously, because none of them ever said the real thing.

**Common business situations.** A ranking table choosing a model · a provider fallback chain · a key
pool · a retry strategy · a load distribution algorithm · a cache mechanism standing in front of a
computation.

## `NAME-5` — an exported function is a verb plus its object

**Situation.** A function is exported out of its file. In an import list the reader sees only **the
name** — no body, no signature.

**What it emits in source.** An exported identifier that is a verb with its object attached, so the
import line alone says what the function does without consulting the path.

**Recognition signs.** The name is a bare verb: `generate`, `parse`, `run`, `handle`, `build`. Reading
the import line, you have to look at the **path** to guess what it does. Two modules exporting the
same bare verb force an alias in the import list.

**Boundary.** Not `NAME-6`: a function returning a boolean does not take verb-plus-object, it takes a
**question** — that is `NAME-6`. Not the exception: this code governs **exports**. A private helper
read three lines from its own body may be a bare verb; the moment it is exported it acquires an
object.

Note: the code forbids a **bare verb**, not a verb. `resolveGradingChain` is legal even though
`resolve` sits on the forbidden list, because it already has an object.

**Common business situations.** Helpers in a `utils/` folder · a factory building a payload · a score
normalisation function · a cost estimation function · a function building a fallback chain · a shared
test helper.

## `NAME-6` — a boolean is a question about a property that lasts

**Situation.** The returned value is a `boolean`. The name must read as a **question**: `isX`, `hasX`,
`canX`.

**What it emits in source.** A predicate whose identifier reads as a yes/no question about a property
that outlives the reason it was added.

**Recognition signs.** The return type is `boolean` or `Promise<boolean>`. The name starts with
`check` — reading as **performing** the check rather than **answering**. The name ends in `Flag`,
which cannot say what it flags.

**Boundary.** Not `NAME-2`: right sentence form with the wrong subject is still `NAME-2`. `isV2` is a
boolean asking about a schema generation; `hasVerifiedMarker` is a boolean asking about a property.
Not `NAME-5`: a function that **actually performs work** and returns something other than a boolean is
entitled to a verb. `checkEligible` returns which tiers were reached — it does real work, and it is
**not** a violation of this code.

Why "a property that lasts" and not merely "a property": a correctly shaped question about something
temporary (`isCurrentlyInBatch`) dies with the temporary thing. The question must be about something
still alive after the next change.

**Common business situations.** Checking whether a learner is enrolled · checking whether a plan is
still valid · checking whether a seeder is enabled · checking whether a snapshot has content ·
checking a role's permission.

## `NAME-7` — the name states the capability, not the first caller

**Situation.** A shared capability is named after the **first surface that asked for it**:
`DashboardContentService`.

**What it emits in source.** A capability-named symbol in the shared layer — `streak`, `loyalty`,
`progress`, `user` — with the surface word appearing only in the per-surface operation path that
calls it.

**Recognition signs.** The name of a shared service contains the name of a screen, a page or a tab. It
lives in the shared layer but has exactly one caller — for now. The day a second caller appears, it
**still runs** and **still says the wrong thing**.

**Boundary.** Not `NAME-1`: a surface-shaped operation folder is a legitimate scope for that operation
itself; what is forbidden is carrying the surface word into a shared service. Not the exception: if
the word that looks like a caller is in fact the business concept — a read model built for exactly
that surface — then it is naming itself, not naming whoever asked first.

Why this code is the hardest to see: the other six are wrong because something **changed**. This one
is wrong because something was **added**, and nobody re-reads old names when something is added.

**Common business situations.** An aggregation service that at first has one page using it · a
formatting helper that at first has one email using it · a projection that at first has one widget
reading it · a query builder that at first has one tab calling it.

## Layer held

There is no application layer that owns naming and no layer that can stay ignorant of it — every layer
declares symbols. What v2 records instead is the **tier** that actually holds each code:
`unrepresentable` means a closed union or branded type makes the wrong value impossible to write;
`enforced` means a lint rule in `starci-eslint/packages/be/naming.mjs` catches it; `documented` means nothing
mechanical holds it and only a reader does.

| Code | Tier | What holds it |
|---|---|---|
| `NAME-1` | `documented` | — |
| `NAME-2` | `enforced` | `no-version-in-name` (export `noVersionInName`) |
| `NAME-3` | `documented` | — |
| `NAME-4` | `documented` | — |
| `NAME-5` | `enforced` | `no-bare-verb-export` (export `noBareVerbExport`) |
| `NAME-6` | `documented` | — |
| `NAME-7` | `documented` | — |

**Two enforced, five documented, none unrepresentable.** The empty `unrepresentable` column is
structural rather than an omission: an identifier is not a value, so no closed union or branded type
can make a bad one unwritable. `isV2` is legal TypeScript in every position `hasVerifiedMarker` is
legal in, and the compiler has no opinion about which one told the truth. That is the whole reason
this module exists as prose.

The two enforced rows are also the two narrowest. `no-version-in-name` visits declarations —
function, class, interface, type alias, method — and does not visit variables or properties, so a
versioned name written as a local `const` passes. `no-bare-verb-export` matches a closed list of
eighteen verbs, so a bare verb outside that list passes. Both gaps are real: a tier table that rounds
"partly" up to "enforced" is the same lie this law is about. Every `documented` row remains an open
risk, held by a reader and nothing else.

## Anchor

Real code each law can be checked against. A law that cannot be pointed at is a proposal.

| Code | Anchor | What to look for |
|---|---|---|
| `NAME-1` | `src/modules/platform/event/nats/producer.service.ts` · `src/modules/platform/event/nats/nats-bridge.service.ts` | Two files in one folder. The first names only the subject and declares `NatsProducerService` — folder plus file read together. The second repeats the folder word in the file name and declares `NatsBridgeService`, saying "nats" twice for the same one class name |
| `NAME-1` | `src/modules/init/seeders/courses/path/content.service.ts` · `src/modules/init/seeders/courses/parsers/content.service.ts` | The pair the law was written from: identical file names, different folders, declaring `ContentPathService` and `ContentParserService`. This is why the file is not called `content-parser.service.ts` |
| `NAME-1` | `src/features/api/core/graphql/mutations/ai/purchase-ai-subscription/` | Every file suffix matches its export's role — `.handler.ts` declares a `*Handler`, `.resolver.ts` a `*Resolver`, `.module.ts` a `*Module` — and none of them repeats the operation folder's role in the file name |
| `NAME-2` | `src/features/api/processors/ai/shared/project-evaluation/project-evaluation-prompt.service.ts` → `ProjectEvaluationV2PromptInput` | A live interface the lint rule would report today. Read it and ask what "V2" tells a reader who does not know whether a V3 exists |
| `NAME-2` | `src/features/api/processors/ai/review-milestone-task/steps/review-milestone-task-grade-step.service.ts` → `const isV2Task = Boolean(milestoneTask.verified)` | The name says a generation while the expression right beside it says the property, `verified`. Also the exact shape the rule does not visit, so it is the anchor for both the law and the enforcement gap |
| `NAME-3` | `src/tests/helpers/git-mount.ts` → `readGitMountDoc`, `GitMountDoc`, and the block comment above `MOUNT_DATA` | The repaired name plus the record of what it was repaired from: one mount renamed twice, helpers that kept the first name through both, and a skip-gate that turned the missing path into a passing run |
| `NAME-4` | `src/modules/ai/utils/compute-model-weight.ts` · `src/modules/ai/utils/credit-for-typical-call.ts` | Names taken from what is computed — a model weight, the credit a typical call costs — rather than from the routing arrangement that consumes them. The weights survived a roster change; a name built on the routing arrangement would not have |
| `NAME-5` | `src/modules/ai/utils/` → `computeModelWeight`, `estimateUsdPerCall`, `resolveGradingChain`, `creditForTypicalCall` | Four exports, four objects. `resolveGradingChain` is the interesting one: `resolve` is on the rule's bare-verb list and passes, because the code forbids a bare verb, not a verb |
| `NAME-5` | `src/tests/helpers/judge.ts` → `export const judge` | A bare-verb-shaped export that the rule's closed word list does not contain. Read it as the boundary of the enforcement, not of the law |
| `NAME-6` | `src/modules/init/scope/seed-scope.service.ts` → `isSeedersEnabled`, `isCoursesSeederEnabled` · `src/modules/init/data-git/data-git.service.ts` → `hasContent` | Questions about properties that outlive the reason they were added |
| `NAME-6` | `src/modules/bussiness/user/user.service.ts` → `checkEnrollment` · `src/modules/bussiness/achievements/badges/abstract-badge.ts` → `checkEligible` | Both start with `check`, and only the first is a finding: its spec asserts `toBe(true)`, so it answers a question and should say `is`. `checkEligible` returns which tiers were reached, so it really does perform work and is correctly not a boolean question |
| `NAME-7` | `src/modules/bussiness/` · `src/features/api/core/graphql/queries/dashboard/active-advertisement/active-advertisement.resolver.ts` | The shared layer is named by capability throughout — `streak`, `loyalty`, `progress`, `user` — with no service named for a surface. The surface word appears only in the per-surface operation path, and the resolver there reaches a capability-named `UserService`. That asymmetry is the code, rendered |

Every code is anchored. None reads "not yet anchored".

## Inputs

| Input | Evidence required |
|---|---|
| subject | The thing itself, stated without reference to a schema generation, a path, a mechanism or a caller |
| role | Service, handler, resolver, module, util, constant — and the file suffix that declares it |
| scope | The folder the symbol lives under, and which word of it is role and which is subject |
| return | For a predicate: the declared return type, because it decides between a question and an operation |
| callers | Every surface that already calls it, and every surface that plausibly will |
| durability | The next reasonable change, and whether the name survives it |

## Rules

1. A file suffix agrees with the role of what it exports.
2. The path carries role and scope; the file name adds only the subject.
3. No identifier encodes a schema generation, a directory, a mount or a mechanism.
4. An exported function names its object.
5. A boolean is a question, and the question is about a property that lasts.
6. A capability is not qualified by whichever surface asked first.
7. A name that must be renamed by a foreseeable change was not naming the thing.
8. Every declared symbol resolves to exactly one code. No symbol is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **The mechanism IS the subject** (`NAME-4`). This code does not touch an integration module whose
  whole job is one external system: a client for a broker names the broker, because that is what a
  reader is looking for. The refusal is naming a BUSINESS capability after the infrastructure it
  currently rides.
- **The version IS the value** (`NAME-2`). This code does not touch a field, column or constant that
  models a version as data — a stored `schemaVersion`, a published API path segment, a migration class
  whose identity is its ordinal. Those name a value; `isV2` names a fork.
- **The folder IS the subject** (`NAME-1`). This code accepts a repeated word when the folder word is
  the subject rather than a role — a module file that declares the module of the folder it names has
  nothing else to be called.
- **Module-local verbs** (`NAME-5`). This code governs EXPORTS. A private helper read three lines from
  its own body may be a bare verb; the moment it is exported it acquires an object.
- **The surface IS the domain** (`NAME-7`). This code does not fire when the word that looks like a
  caller is the business concept — a per-surface read model legitimately names that surface, because
  the surface is what it is, not who asked.

## Output

One block per file the accepted shape produces.

```text
symbol: <the declared name>
path: <folder/file>
role: <service | handler | resolver | module | util | constant | predicate>
situation: <NAME-1 … NAME-7>
subject: <what the name is about>
reason: <the foreseeable change the name survives, and the substitute it refused>
```

## Worked example

**The accepted shape.** A shared capability reads the seeded content documents that currently live
behind a git mount, a seed-scope predicate says whether the seeders are enabled, and one dashboard
surface exposes an advertisement read through a single GraphQL query operation.

```text
symbol: readGitMountDoc
path: src/tests/helpers/git-mount.ts
role: util
situation: NAME-3
subject: the mount document being read
reason: survives the storage directory being renamed again — it already has been, twice; refused readVolumeDoc, the address the thing currently sits behind. Not NAME-4, because the mount is where the document sits, not the mechanism that produces it
```

```text
symbol: isSeedersEnabled
path: src/modules/init/scope/seed-scope.service.ts
role: predicate
situation: NAME-6
subject: whether seeding is enabled
reason: survives as a yes/no question about a property that outlives the reason it was added; refused checkSeeders, which reads as performing the check, and seedersFlag, which names nothing. Not NAME-2, because the question is about a property and not about a schema generation
```

```text
symbol: ActiveAdvertisementResolver
path: src/features/api/core/graphql/queries/dashboard/active-advertisement/active-advertisement.resolver.ts
role: resolver
situation: NAME-1
subject: the active advertisement read for this operation
reason: the path carries role and scope, the file adds only the subject, and the .resolver.ts suffix agrees with the exported role; refused repeating the operation folder's role inside the file name. Not NAME-7, because "dashboard" here is the per-surface operation path, which is a legitimate scope for the operation itself
```

```text
symbol: UserService
path: src/modules/bussiness/user/user.service.ts
role: service
situation: NAME-7
subject: the shared user capability
reason: survives a second surface calling it tomorrow; refused DashboardUserService, the first caller as qualifier. Not NAME-1, because the surface word is not this folder's role or scope — the shared layer is named by capability and the surface word belongs only in the operation path
```

**What the shape does not state, and therefore does not resolve.** It does not state which generation
the content documents are on, so no identifier here may carry one — a `NAME-2` decision the shape has
not made. It does not state the mechanism that fetches from the mount, so no name may be built on it
(`NAME-4`). It does not state how many surfaces will call the shared capability, which is exactly why
`NAME-7` names the capability rather than the one caller that exists today.

## Scope

This rule holds for any back-end code of this kind in this stack — any symbol read at a call site
before it is opened. It names no single feature: the examples are ordinary TypeScript in a
NestJS-shaped application and name no product, no repository and no course. The two rule ids are the
only proper nouns in the law itself, because a rule id is an enforcement identity and a renamed rule
cannot be cited in a config. Repository paths appear under Anchor and nowhere else — an anchor is
required to be a real path, which is exactly what makes it an anchor.
