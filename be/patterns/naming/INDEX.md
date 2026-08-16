---
id: be-patterns-naming-index
title: INDEX.md
slug: /be/patterns/naming
sidebar_label: naming
sidebar_position: 0
description: Binding rules for what a back-end name must say, and for the four things it must never encode.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `naming`

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
Two of the seven codes have a lint rule behind them; the other five have only a reader. The
`Tầng giữ` table says which is which rather than implying uniform enforcement.

## Situation Codes

Every situation this module governs carries a code, `NAME-<n>`. The numbers are FIXED: they are
cited from sibling laws and from historical task records, so a renumber silently breaks a citation
somebody already made.

| Code | What it requires | What it forbids |
|---|---|---|
| `NAME-1` | The path carries the role and the scope; the file names the subject; the declared symbol is the two read together, and the file suffix agrees with the export's role (`*.service.ts` declares a `*Service`, `*.handler.ts` a `*Handler`) | Repeating the folder's role or scope inside the file name; a suffix that claims a role the export does not have |
| `NAME-2` | The name states the property, so it survives the generation that introduced it | A schema generation baked into an identifier (`isV2`, `V2Params`, `parseV2Body`) |
| `NAME-3` | The name states the subject | A name taken from the directory, mount, bucket or path the thing currently sits behind |
| `NAME-4` | The name states the thing being chosen, produced or measured | A name taken from the mechanism that currently produces it |
| `NAME-5` | An exported function is a verb plus its object | A bare-verb export (`generate`, `parse`, `run`) that forces the reader back to the path |
| `NAME-6` | A boolean is a question — `isX`, `hasX`, `canX` — about a property that lasts | `checkX`, which reads as performing the check; `xFlag`, which names nothing; a question about a generation rather than a property |
| `NAME-7` | The name states the capability | A name qualified by whichever surface asked for it first |

Seven codes, and it ends at seven. A situation that genuinely has no code is a rule change recorded
in `changelog.md`, not an eighth number added in passing.

`NAME-2`, `NAME-3` and `NAME-4` are one sentence said three times against three different tempting
substitutes, and they stay three codes because the substitutes fail differently: a version is wrong
on a schedule, a path is wrong the day somebody else runs a rename, and a mechanism is wrong all at
once, taking every neighbouring name with it.

## Tầng giữ

Which tier actually holds each code. `unrepresentable` means a closed union or branded type makes
the wrong value impossible to write; `enforced` means a lint rule in
[`sources/be/naming.mjs`](../../../sources/be/naming.mjs) catches it; `documented` means nothing
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
eighteen verbs, so a bare verb outside that list passes. Both gaps are named again in `audit.md`
with the live example that proves them, because a tier table that rounds "partly" up to "enforced"
is the same lie this law is about.

Every `documented` row is named again in `audit.md` under "Rủi ro còn mở", with what a rule would
have to be able to SEE in order to hold it — and, for two of them, why no rule can.

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

Every code is anchored. None reads `chưa neo được`.

## Inputs

| Input | Evidence required |
|---|---|
| subject | The thing itself, stated without reference to a schema generation, a path, a mechanism or a caller |
| role | Service, handler, resolver, module, util, constant — and the file suffix that declares it |
| scope | The folder the symbol lives under, and which word of it is role and which is subject |
| return | For a predicate: the declared return type, because it decides between a question and an operation |
| callers | Every surface that already calls it, and every surface that plausibly will |
| durability | The next reasonable change, and whether the name survives it |

## Invariants

- A file suffix agrees with the role of what it exports.
- The path carries role and scope; the file name adds only the subject.
- No identifier encodes a schema generation, a directory, a mount or a mechanism.
- An exported function names its object.
- A boolean is a question, and the question is about a property that lasts.
- A capability is not qualified by whichever surface asked first.
- A name that must be renamed by a foreseeable change was not naming the thing.
- Every declared symbol resolves to exactly one code. No symbol is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **The mechanism IS the subject.** `NAME-4` does not touch an integration module whose whole job is
  one external system: a client for a broker names the broker, because that is what a reader is
  looking for. The refusal is naming a BUSINESS capability after the infrastructure it currently
  rides.
- **The version IS the value.** `NAME-2` does not touch a field, column or constant that models a
  version as data — a stored `schemaVersion`, a published API path segment, a migration class whose
  identity is its ordinal. Those name a value; `isV2` names a fork.
- **The folder IS the subject.** `NAME-1` accepts a repeated word when the folder word is the
  subject rather than a role — a module file that declares the module of the folder it names has
  nothing else to be called.
- **Module-local verbs.** `NAME-5` governs EXPORTS. A private helper read three lines from its own
  body may be a bare verb; the moment it is exported it acquires an object.
- **The surface IS the domain.** `NAME-7` does not fire when the word that looks like a caller is
  the business concept — a per-surface read model legitimately names that surface, because the
  surface is what it is, not who asked.

## Output

```text
symbol: <the declared name>
path: <folder/file>
role: <service | handler | resolver | module | util | constant | predicate>
situation: <NAME-1 … NAME-7>
subject: <what the name is about>
reason: <the foreseeable change the name survives, and the substitute it refused>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.
`changelog.md` is read when a version marker disagrees with what a record says.

## Scope

This module states a rule true of any back end whose symbols are read at call sites before they are
opened. Examples are ordinary TypeScript in a NestJS-shaped application: they name no product, no
repository and no course. The two rule ids are the only proper nouns in the law itself, because a
rule id is an enforcement identity and a renamed rule cannot be cited in a config. Repository paths
appear in `Anchor` and nowhere else — an anchor is required to be a real path, which is exactly what
makes it an anchor.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
Adding, removing or renumbering a `NAME-<n>` code is a major change, not an increment.
