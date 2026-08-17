---
title: Module layering
---

# Module layering

The input to this pattern is a shape that has already been accepted: a capability that exists, a
module that is meant to be registered, a symbol that some other file has been granted the right to
use. None of that is re-opened here. The output is source architecture — which file the specifier
names, which layer holds the knowledge, what may be imported, what may be exported, and where the
edge between two capabilities is allowed to be wired.

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

Two of the five codes have a lint rule behind them; three have only a reader. The **Layer held**
table below says which is which rather than implying uniform enforcement.

## Situation codes

Every situation this module governs carries a code, `LAYERING-<n>`. The numbers are FIXED: they are
cited from sibling laws and from historical task records, so a renumber silently breaks a citation
somebody already made.

| Code | Situation | What the source must look like |
|---|---|---|
| `LAYERING-1` | Taking a symbol from another capability | An import names the file that declares the symbol — the specifier reaches past the capability to something that can be opened. Forbidden: a specifier that stops at a capability folder, so that one symbol arrives with the folder's whole import graph attached and no reader can tell which file is depended on |
| `LAYERING-2` | Taking a symbol from your own capability | Inside a capability, an import of that same capability is relative. Forbidden: a file reaching its own capability through the public alias, which makes the alias stop meaning "this comes from elsewhere" |
| `LAYERING-3` | Two capabilities need to know each other | A dependency between two capabilities is registered at the application's composition root. Forbidden: a capability `@Module` importing a sibling capability's module, wiring a decision in a file whose subject is neither of them |
| `LAYERING-4` | Something knows the whole picture — how many capabilities exist, which are global, which starts first | The composition root owns which capabilities exist, which are global, and what order they start in. Forbidden: any of that knowledge living inside a capability, which is what makes the capability un-startable alone |
| `LAYERING-5` | Deciding what of a capability is public | A capability's public surface is the set of files it means to be imported, visible in its callers' import lists. Forbidden: an index that re-exports the folder, which turns the surface into a list nobody reads and every rule above into a suggestion |

Five codes, and it ends at five. A situation that genuinely has no code is a recorded rule change,
not a sixth number added in passing.

`LAYERING-1` and `LAYERING-5` are the same fact from the two ends of the wire. `LAYERING-1` is the
obligation on the caller; `LAYERING-5` is the obligation on the callee, and it is the one that makes
the other enforceable — a barrel that exists will be imported, so the only durable way to hold
`LAYERING-1` is for there to be nothing to import. They stay two codes because they fail at
different times and are fixed by different people: a bad specifier is one caller's line, a barrel is
every future caller's invitation.

## Reading an accepted shape

1. **Read what the shape states.** It states that a capability exists and owns one subject, that a
   symbol is to be used, or that a module is to be registered. Take that as settled.
2. **Read what it does not state, and therefore does not resolve.** An accepted shape does not state
   the import specifier, does not state which file inside a capability declares the symbol, does not
   state whether the edge is global, and does not state start order. Those are resolved here, or
   they are resolved by accident.
3. **Resolve outermost first.** Settle the root before the capability and the capability before the
   file: what the application knows (`LAYERING-4`), then which edges the root wires (`LAYERING-3`),
   then what a capability exposes (`LAYERING-5`), then how a caller names it (`LAYERING-1`), then
   how the capability names itself (`LAYERING-2`).
4. **Ask each code's question in turn.** Does the fact hold for every application using this
   capability? Is the edge sideways, downward, inward or root? Is the surface readable from call
   sites? Does the specifier open a file or a folder? Is the target inside the same capability as
   the importer?
5. **When two codes both match, they both apply.** One line can be wrong twice — a self-alias that
   also stops at a folder answers `LAYERING-2` and `LAYERING-1` together, and each must be resolved
   on its own terms. The codes are not exclusive buckets; every import specifier and every module
   registration resolves to exactly one code per question asked, and no edge is out of scope.

## `LAYERING-1` — an import names a file, not a folder

**Situation.** A file needs a symbol that lives in another capability. The specifier written must
run all the way to the file that declares that symbol, rather than stopping at the capability name.

**What it emits in source.** A cross-capability specifier whose last segment is a file: the caller's
import block lists the real dependencies of the file, and every one of them can be opened directly.

**Recognition signs.**

- The specifier ends right after the capability name, with nothing after it.
- A file exists inside that capability whose only content is `export ... from` other files.
- Reading the whole import block does not tell you which file is actually depended on.
- The question to ask: if I open exactly the path I just wrote, do I open a file, or a folder?
- Category-folder trap: some folders hold capabilities rather than being one (`platform/`, `lib/`,
  `integrations/`, and in many trees `databases/`). Under those, the capability is the second
  segment, so "reaches a file" is one segment deeper, and a specifier stopping at
  `<category>/<capability>` is still a barrel even though it looks like two segments.

**Boundary.** This is not `LAYERING-2`: `LAYERING-1` asks where the specifier stops, `LAYERING-2`
asks whether it may be an alias at all — a single line can be wrong on both counts, a self-alias
that also stops at a folder. It is not `LAYERING-5` either: `LAYERING-1` is the caller's obligation
and `LAYERING-5` is the callee's, so a caller can write correct specifiers forever while the callee
still leaves a barrel sitting there — and that barrel will be imported, just not yet.

**Common business situations.** Taking a shared service; taking an enum from the data layer; taking
an exception class; taking a configuration constant; taking a type used at a boundary; an
`export ... from` bridging to another capability.

## `LAYERING-2` — inside a capability the path is relative

**Situation.** A file sits inside a capability and needs another file of that same capability. The
path must be relative.

**What it emits in source.** Relative specifiers (`./`) for everything internal, and the public
alias appearing only on lines that genuinely leave the capability — so renaming the capability never
touches its own internal imports.

**Recognition signs.**

- The public alias appears on a line whose target is in the same capability as the source.
- The capability folder appears twice on one path: once because the file is there, once inside the
  specifier.
- Renaming the capability forces edits to its own internal imports.
- The question to ask: is the target in the same capability folder as the file I am writing? If yes,
  the path is `./`.
- Why a self-pointing alias is dangerous: the alias exists to signal "this comes from elsewhere".
  Using it for something that does not come from elsewhere is the fastest way to drain that signal;
  after that nobody reads the alias as a boundary any more, and an unreadable boundary is no
  boundary.

**Boundary.** This is not `LAYERING-1` — see above. It is not `LAYERING-3` either: `LAYERING-2` is
about a specifier in any file, `LAYERING-3` is about the edge between two `@Module`s. A
`LAYERING-3` violation always comes with a sideways specifier; a `LAYERING-2` violation crosses to
nowhere at all — it just goes the long way round.

**Common business situations.** A module file loading its own providers; a service calling a sibling
service; an internal util; an internal type; a module-options definition file; a spec sitting beside
the file it tests.

## `LAYERING-3` — the sideways edge is wired at the composition root

**Situation.** Two capabilities need to know each other. Somewhere must know both — and that
somewhere is the application root, whose entire job IS knowing what the application consists of.

**What it emits in source.** The registration of both capabilities in the root's module list, and
two capability modules neither of which names the other.

**Recognition signs.**

- A capability `@Module`'s `imports:` contains another capability's `@Module`.
- The decision "these two go together" is recorded in a file whose subject is not both of them.
- Starting one capability to debug it drags the other one along.
- The question to ask: is the file I am writing the place that OWNS the question "what does this
  application consist of"? If not, this edge does not get wired here.
- Why not wire it directly: two directly wired capabilities can no longer be started apart, and the
  first thing anyone wants during an incident is to start one piece and see whether that piece is
  alive.

**Boundary.** This is not a downward edge: if the imported module is a child of this same
capability, that is nesting, and nesting is allowed — this code is about sideways edges, not
downward ones, and an aggregator collecting its child modules and re-exporting them is valid. It is
not `LAYERING-4` either: `LAYERING-3` says where an edge may not be wired, `LAYERING-4` says what
else may only be known at the root. Drop `LAYERING-4` and `LAYERING-3` becomes a formality — the
edge travels up to the root while start order stays scattered under the capabilities.

**Common business situations.** A business capability needing an integration's client; a feature
needing a shared service; two capabilities both needing a broker; a capability needing a cache; a
processor needing an entity manager.

## `LAYERING-4` — only the root knows the whole picture

**Situation.** Some facts are about the whole application: how many capabilities there are, which is
registered global, which must load before which, and how this capability is configured differently
in which application. All of those belong to the root.

**What it emits in source.** Per-application registration and configuration written at each root,
including the same capability registered by two roots with two different answers, and start-order
knowledge held in the file whose subject IS the whole.

**Recognition signs.**

- A capability declares itself `isGlobal` on the application's behalf.
- A comment of the form "must be imported before X" sits in a file belonging to a capability.
- The same capability needs two different configurations in two applications, and that configuration
  is buried inside the capability.
- The question to ask: is this fact true for EVERY application that uses this capability? If not, it
  is not the capability's knowledge.
- Why this is its own code rather than folded into `LAYERING-3`: they break in two different ways. A
  `LAYERING-3` violation glues two capabilities together. A `LAYERING-4` violation makes ONE
  capability unable to start on its own, and no second capability has to take part for that to
  happen.

**Boundary.** This is not `LAYERING-3` — see above. It is not `LAYERING-5` either: `LAYERING-4` says
who may know the whole picture, `LAYERING-5` says what each capability exposes. A capability can
expose exactly the right surface and still hide start-order knowledge in its guts.

**Common business situations.** A main application root and a CLI root configuring the same
capability differently; a side-effect import that must run first; the list of global modules; env
loading ordered before everything else; a root recording what it deliberately does NOT pull in.

## `LAYERING-5` — the public surface is the files meant to be imported

**Situation.** Deciding what of this capability is public. The answer is: the files we intend other
people to import. No index re-exports the folder; the caller names the file itself.

**What it emits in source.** No `index.ts` anywhere in the capability, and an alias mapping with no
barrel specifier to resolve to — so the surface is readable only from callers' import lists.

**Recognition signs.**

- A file whose entire content is `export ... from`.
- Adding a file to the folder widens the public surface without anyone deciding it.
- Finding out what this capability exposes requires opening a list file instead of reading call
  sites.
- The question to ask: is this capability's surface being read in the import lists of the places
  that call it, or declared in a file nobody opens?
- Why the surface belongs at the call site: a wrong dependency then shows up as an import line that
  looks odd — the kind a reviewer spots instantly. When the surface lives in a barrel, a wrong
  dependency is just one more name on a long list, and long lists go unread.

**Boundary.** This is not `LAYERING-1` — see above; these are two ends of the same wire. It is not
`LAYERING-4` — see above.

**Common business situations.** Adding a new service to a capability; grouping things "to tidy the
imports"; building a public API for a shared layer; re-exporting a type to avoid writing the long
path; a util folder with many small functions.

## Layer held

Which tier actually holds each code. `unrepresentable` means a closed union or branded type makes
the wrong value impossible to write; `enforced` means a lint rule in `starci-eslint/packages/be/module-layering.mjs`
catches it; `documented` means nothing mechanical holds it and only a reader does.

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
A tier table that rounds "partly" up to "enforced" is the same failure this law is about.

`LAYERING-3` is `documented` here and that is a deliberate omission in canon rather than an
oversight. Deciding whether an imported module is a sibling capability or a nested child needs the
module graph, and a rule reading one file at a time cannot see it. A repository adopting this law
should port that rule as a gate that walks the tree and is scoped by path glob — the reference
repository's own glob-scoped gate is recorded in **Anchor** below. It is real enforcement, but it is
not canon's, so this table does not claim it.

The layers that must stay ignorant follow from the same table: a capability must not hold which
applications exist, which capabilities are global, or what starts first; a sibling capability must
not hold the edge to another sibling; and a callee capability must not hold a list declaring its own
surface.

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

Every code is anchored. None reads "not yet anchored".

## Inputs

| Input | Evidence required |
|---|---|
| specifier | The exact import string, and whether it is one of the repository's aliases, a relative path, or a published package |
| importer | The path of the file doing the importing, because that is what decides which capability is "self" |
| capability | The folder that owns the subject — and, under a category folder, which segment names it |
| edge | Inward, downward, sideways, or root: whether the dependency crosses a capability boundary, descends within one, or is the root knowing the whole |
| registration | For a `@Module`: where it is registered, whether it is global, and what per-instance configuration it carries |
| surface | Which files of the callee capability are meant to be imported, read from real call sites |

## Rules

1. An import specifier reaches a file, never a capability folder.
2. Under a category folder the capability is the second segment, so "reaches a file" is one segment deeper.
3. Inside a capability, an import of that capability is relative.
4. The public alias appears only on lines that genuinely leave the capability.
5. A capability `@Module` does not import a sibling capability's module.
6. Which capabilities exist, which are global and what starts first is stated only at the composition root.
7. No file re-exports a folder.
8. A capability moved to another repository with its own folder still resolves every import it declares.
9. Every import specifier and every module registration resolves to exactly one code. No edge is out of scope.

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

One block per file the shape produces.

```text
specifier: <the import string, or the module being registered>
importer: <path of the file that declares it>
capability: <the folder that owns the subject>
edge: <inward | downward | sideways | root>
situation: <LAYERING-1 … LAYERING-5>
reason: <the cycle or the un-startable piece the choice refuses>
```

## Worked example

**Accepted shape.** An AI invocation service inside the `ai` capability may use a model-provider
enum owned by the data layer and a sibling entitlement service of its own capability, and the `ai`
capability is registered globally by the core application.

The shape states that the capability exists, that the symbols may be used, and that the registration
is global. It does not state the import specifiers, which file declares the enum, whether the `ai`
module may name the data-layer module, or where "global" is written down — so none of that is
resolved by the shape, and all of it is resolved here.

```text
specifier: @modules/databases/postgresql/primary/enums/model-provider
importer: src/modules/ai/ai-invoke.service.ts
capability: databases/postgresql/primary
edge: inward
situation: LAYERING-1
reason: the specifier ends at the declaring file rather than at the capability folder; this is not LAYERING-5 because the fact that decides it is the caller's own line, not anything the callee publishes, and under a category folder the capability is the second segment so the depth required is one segment deeper
```

```text
specifier: ./ai-entitlement.service
importer: src/modules/ai/ai-invoke.service.ts
capability: ai
edge: downward
situation: LAYERING-2
reason: the target sits in the same capability as the importer, so the public alias would stop meaning "this comes from elsewhere"; this is not LAYERING-1 because the fact that decides it is that importer and target share a capability, and the path crosses to nowhere at all
```

```text
specifier: AiModule.register({ isGlobal: true })
importer: apps/core/src/app.module.ts
capability: ai
edge: root
situation: LAYERING-4
reason: whether this capability is global is a fact about one application and not true of every application using it, so it is written at the root; this is not LAYERING-3 because no second capability takes part — the failure it refuses is one capability that can no longer start alone
```

## Scope

This rule holds for any back end assembled from capability folders behind path aliases, with a
composition root that starts them. Examples are ordinary TypeScript in a NestJS-shaped application:
they name no product, no repository and no private module. The two rule ids are the only proper
nouns in the law itself, because a rule id is an enforcement identity and a renamed rule cannot be
cited in a config. Repository paths appear in **Anchor** and nowhere else — an anchor is required to
be a real path, which is exactly what makes it an anchor.
