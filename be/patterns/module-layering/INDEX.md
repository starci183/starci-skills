---
id: be-patterns-module-layering-index
title: INDEX.md
slug: /be/patterns/module-layering
sidebar_label: module-layering
sidebar_position: 0
description: Binding rules for what an import may name, what a capability may say about itself, and where a cross-capability dependency is allowed to be wired.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `module-layering`

## Law

A capability is a folder that owns one subject. The rules here are not about what lives inside a
capability — they are about the SEAMS between capabilities: what an import may name, what a
capability may say about itself, and where a cross-capability dependency is allowed to be wired.

Every one of them exists because the alternatives produce cycles. Not the loud kind the compiler
catches — the quiet kind where a capability reaches its own internals through its public door, where
a barrel drags in a graph nobody asked for, and where a module imports a sibling directly and the
two can no longer be started apart. A cycle of that kind does not fail; it just makes every later
question harder to answer, until the day a unit spec boots a database driver and nobody can say
which import asked for it.

The question that settles a case: **could this file be moved to another repository with its
capability, and still make sense?** If it names a barrel, or reaches sideways, or points at itself
through the public alias, it cannot — and the reason it cannot is that it is holding a dependency it
never declared.

**This is binding, not advisory.** Every import specifier and every `@Module` declaration sits under
exactly one of the codes below. There is no import too small to carry one: a two-line re-export
answers `LAYERING-5` for the same reason an application root answers `LAYERING-4`. "It is one
symbol, from right next door" is where this rule is skipped most often, and the import next door is
exactly the one that turns out to have crossed a boundary.

Two of the five codes have a lint rule behind them; three have only a reader. The `Tầng giữ` table
below says which is which rather than implying uniform enforcement, and every `documented` row is
named again in `audit.md` with what a rule would have to be able to SEE in order to hold it.

## Situation Codes

Every situation this module governs carries a code, `LAYERING-<n>`. The numbers are FIXED: they are
cited from sibling laws and from historical task records, so a renumber silently breaks a citation
somebody already made.

| Code | What it requires | What it forbids |
|---|---|---|
| `LAYERING-1` | An import names the file that declares the symbol — the specifier reaches past the capability to something that can be opened | A specifier that stops at a capability folder, so that one symbol arrives with the folder's whole import graph attached and no reader can tell which file is depended on |
| `LAYERING-2` | Inside a capability, an import of that same capability is relative | A file reaching its own capability through the public alias, which makes the alias stop meaning "this comes from elsewhere" |
| `LAYERING-3` | A dependency between two capabilities is registered at the application's composition root | A capability `@Module` importing a sibling capability's module, wiring a decision in a file whose subject is neither of them |
| `LAYERING-4` | The composition root owns which capabilities exist, which are global, and what order they start in | Any of that knowledge living inside a capability, which is what makes the capability un-startable alone |
| `LAYERING-5` | A capability's public surface is the set of files it means to be imported, visible in its callers' import lists | An index that re-exports the folder, which turns the surface into a list nobody reads and every rule above into a suggestion |

Five codes, and it ends at five. A situation that genuinely has no code is a rule change recorded in
`changelog.md`, not a sixth number added in passing.

`LAYERING-1` and `LAYERING-5` are the same fact from the two ends of the wire. `LAYERING-1` is the
obligation on the caller; `LAYERING-5` is the obligation on the callee, and it is the one that makes
the other enforceable — a barrel that exists will be imported, so the only durable way to hold
`LAYERING-1` is for there to be nothing to import. They stay two codes because they fail at
different times and are fixed by different people: a bad specifier is one caller's line, a barrel is
every future caller's invitation.

## Tầng giữ

Which tier actually holds each code. `unrepresentable` means a closed union or branded type makes
the wrong value impossible to write; `enforced` means a lint rule in
[`sources/be/module-layering.mjs`](../../../sources/be/module-layering.mjs) catches it;
`documented` means nothing mechanical holds it and only a reader does.

| Code | Tier | What holds it |
|---|---|---|
| `LAYERING-1` | `enforced` | `must-deep-module-import` (export `mustDeepModuleImport`) |
| `LAYERING-2` | `enforced` | `no-self-module-alias` (export `noSelfModuleAlias`) |
| `LAYERING-3` | `documented` | — |
| `LAYERING-4` | `documented` | — |
| `LAYERING-5` | `documented` | — |

**Two enforced, three documented, none unrepresentable.** The empty `unrepresentable` column is
structural rather than an omission: an import specifier is a string in a position the type system
resolves but does not constrain, and a `@Module` decorator's `imports` array is typed as modules,
not as permitted edges. No closed union can be written whose inhabitants are "the specifiers this
file is allowed to name", because the allowed set depends on where the file sits — which is exactly
the input a type has no access to.

The two enforced rows are also the two narrowest, and both are narrow in the same direction: they
read one specifier against one filename, and they see nothing else. `must-deep-module-import`
inspects only the three repository aliases, so a relative specifier that names a folder is invisible
to it. `no-self-module-alias` needs to know which capability the importing file belongs to, and it
learns that by splitting the path against a fixed list of category folders — so a category folder
the list does not know about is read as a capability, and the rule answers confidently and wrongly.
Both gaps are named again in `audit.md` with the live path that proves them, because a tier table
that rounds "partly" up to "enforced" is the same failure this law is about.

`LAYERING-3` is `documented` here and that is a deliberate omission in canon rather than an
oversight. Deciding whether an imported module is a sibling capability or a nested child needs the
module graph, and a rule reading one file at a time cannot see it. A repository adopting this law
should port that rule as a gate that walks the tree and is scoped by path glob — the reference
repository's own glob-scoped gate is recorded in `Anchor` below and analysed in `audit.md`. It is
real enforcement, but it is not canon's, so this table does not claim it.

## Anchor

Real code each law can be checked against. A law that cannot be pointed at is a proposal.

| Code | Anchor | What to look for |
|---|---|---|
| `LAYERING-1` | `apps/core/src/app.module.ts` | Sixty-two aliased specifiers and not one stops at a capability. Read `@modules/ai/ai.module` directly beside `@modules/platform/exceptions/filters/abstract-exception-http.filter`: same rule, and the depth that counts as "reaches a file" differs by one because `platform` is a category folder and `ai` is a capability |
| `LAYERING-1` | `src/modules/ai/ai-invoke.service.ts` | Every cross-capability specifier ends at a file — `@modules/platform/env/config`, `@modules/databases/postgresql/primary/enums/model-provider`. A reader can list this service's real dependencies from the import block without opening anything |
| `LAYERING-2` | `src/modules/ai/ai-invoke.service.ts` | The same import block, read for what is NOT there: the sibling services are `./ai-entitlement.service`, `./balancer/use-api.service`, `./utils/openrouter-cache-headers`, and there is no `@modules/ai/...` anywhere in the file. The alias appears only on lines that genuinely leave the capability |
| `LAYERING-2` | `src/modules/ai/ai.module.ts` | A module wiring four providers, two nested modules and its own options class — seven specifiers, every one of them relative. This is the file where the self-alias is most tempting, because a module file is where a capability describes itself |
| `LAYERING-3` | `apps/core/src/app.module.ts` | `AiModule.register({ isGlobal: true })` and `MembershipModule.register({ isGlobal: true })` in one list. Then open both capability modules and confirm neither names the other: the edge exists, and it exists here |
| `LAYERING-3` | `eslint.config.mjs`, the config blocks scoped to `src/modules/**/*.module.ts` and `src/features/**/*.module.ts` | The tree-walking gate canon's source says to port, plus the burn-down comment recording seventeen violations reduced to zero and what each of the last three needed. `apps/*/src/**` is deliberately outside the glob, which is the rule stating in configuration that the root is the exception |
| `LAYERING-3` | `src/modules/bussiness/bussiness.module.ts` | The downward edge the code permits: an aggregator importing its own children relatively, then re-exporting them. Nesting is not the sideways edge this code refuses, and this file is the reason the distinction had to be written down |
| `LAYERING-4` | `apps/core/src/app.module.ts` · `apps/cli/src/app.module.ts` | The same capability registered by two roots with two different answers — `PrimaryPostgreSQLModule.register({ withResolvers: true })` against `{ withResolvers: false })`. Neither answer could have been written inside the capability, because the capability does not know which application it is being started into |
| `LAYERING-4` | `apps/core/src/main.ts` | The first statement in the file is a side-effect import that must precede every other import, with the comment saying why. Start order is knowledge about the whole, and it is held in the file whose subject IS the whole |
| `LAYERING-4` | `apps/cli/src/app.module.ts`, the class doc comment | A root recording what it deliberately does NOT pull in and which subcommand made each addition necessary. The reasoning is only expressible at a root; inside a capability there is no "which application" for it to be about |
| `LAYERING-5` | `src/` | Zero `index.ts` files in the entire source tree. The surface of every capability is therefore readable only from its callers' import lists, which is the claim this code makes |
| `LAYERING-5` | `tsconfig.json`, the `paths` block | `@modules/*` maps to `./src/modules/*` and nothing else, so a barrel specifier has no file to resolve to. Read this together with the previous row: the absence is what makes the mapping safe, not the mapping |

Every code is anchored. None reads `chưa neo được`.

## Inputs

| Input | Evidence required |
|---|---|
| specifier | The exact import string, and whether it is one of the repository's aliases, a relative path, or a published package |
| importer | The path of the file doing the importing, because that is what decides which capability is "self" |
| capability | The folder that owns the subject — and, under a category folder, which segment names it |
| edge | Inward, downward, sideways, or root: whether the dependency crosses a capability boundary, descends within one, or is the root knowing the whole |
| registration | For a `@Module`: where it is registered, whether it is global, and what per-instance configuration it carries |
| surface | Which files of the callee capability are meant to be imported, read from real call sites |

## Invariants

- An import specifier reaches a file, never a capability folder.
- Under a category folder the capability is the second segment, so "reaches a file" is one segment deeper.
- Inside a capability, an import of that capability is relative.
- The public alias appears only on lines that genuinely leave the capability.
- A capability `@Module` does not import a sibling capability's module.
- Which capabilities exist, which are global and what starts first is stated only at the composition root.
- No file re-exports a folder.
- A capability moved to another repository with its own folder still resolves every import it declares.
- Every import specifier and every module registration resolves to exactly one code. No edge is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Downward edges stay.** `LAYERING-3` governs SIDEWAYS edges. A capability importing its own
  nested child, and an aggregator module importing and re-exporting the modules beneath it, are
  downward: the importer already owns the subject. Refusing those would mean a capability cannot be
  composed at all, which is not what any of this is for.
- **The composition root is exempt from `LAYERING-3` by definition.** Knowing about two capabilities
  at once is not a violation there; it is the root's entire subject, which is what `LAYERING-4`
  says. This is why an application root sits outside the glob that enforces the sideways refusal.
- **A published package entry point is not a barrel.** `LAYERING-1` governs the repository's own
  aliases. A third-party package's entry point is the vendor's declared surface and its graph is the
  vendor's decision; naming a file inside someone else's package is reaching past a boundary they
  drew, which is the opposite of what this code asks for.
- **A category folder is not a capability.** `LAYERING-1` and `LAYERING-2` both read one segment
  deeper under a folder that holds capabilities rather than being one. A specifier stopping at
  `<category>/<capability>` is still a barrel, and a file under that path is self for BOTH the long
  and the short form of its capability name.
- **A module file may name its own folder.** `LAYERING-2` is about the alias, not about repetition:
  the module file of a capability necessarily describes that capability. It does so with relative
  specifiers, and the repetition is the subject, not a smell.

## Output

```text
specifier: <the import string, or the module being registered>
importer: <path of the file that declares it>
capability: <the folder that owns the subject>
edge: <inward | downward | sideways | root>
situation: <LAYERING-1 … LAYERING-5>
reason: <the cycle or the un-startable piece the choice refuses>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.
`changelog.md` is read when a version marker disagrees with what a record says.

## Scope

This module states a rule true of any back end assembled from capability folders behind path
aliases, with a composition root that starts them. Examples are ordinary TypeScript in a
NestJS-shaped application: they name no product, no repository and no private module. The two rule
ids are the only proper nouns in the law itself, because a rule id is an enforcement identity and a
renamed rule cannot be cited in a config. Repository paths appear in `Anchor` and nowhere else — an
anchor is required to be a real path, which is exactly what makes it an anchor.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
Adding, removing or renumbering a `LAYERING-<n>` code is a major change, not an increment.
