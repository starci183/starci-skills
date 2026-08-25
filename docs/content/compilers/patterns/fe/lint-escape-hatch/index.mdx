---
title: Lint-escape-hatch
---

# Lint-escape-hatch

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | the published frontend machine this record cites |


## Record

The input is a shape already accepted — a component, a config block, a rule that a repository has
decided to ship. The output is source architecture: which file holds the rule, what the config that
switches it on must also carry, where a legitimate case is written down, and what the file being
reported is allowed to say about itself. This pattern does not re-open whether the rule is right. It
lands the decision in source, and the only question it answers is where each part of it goes.

## Law

A lint escape hatch is source text that changes which laws apply to the file containing it:
`eslint-disable`, its line variants, or `eslint-enable`. It turns a repository law into a local
choice, so the author of the violation also becomes the author of whether it is a violation.

That inversion is the whole subject. Every other property of a directive — how narrow it is, which
rule it names, how good the reason beside it reads — describes the *shape* of the bypass. None of
them changes who decided. A rule is repository policy at `error`; a file is not a party to it, and a
file that can answer the question is not being governed, it is negotiating.

> Does this text let one file decide whether a rule applies to it?

**This is binding, not advisory.** There is no size of bypass small enough to be a note rather than a
decision, and no reason good enough to convert one into the other. A rule that is wrong is corrected
in its matcher or in the architecture, for everyone, in a diff that can be reviewed — which is the
same repair the directive was avoiding.

## Situation codes

Every situation this module governs carries a code, `LINT-ESCAPE-<n>`. The code names the SITUATION;
the columns name the situation and what the source must look like once it is resolved.

| Code | Situation | What the source must look like |
|---|---|---|
| `LINT-ESCAPE-1` | A product file meets a rule that blocks it | Product source contains no inline ESLint directive — no `eslint-disable`, no `-next-line`, no `-line`, no `eslint-enable`. It forbids a file lowering, suspending or restoring repository policy for itself, and a bypass excused by the reason written beside it |
| `LINT-ESCAPE-2` | The rule is switched on, but the resolved config still honours inline config | The flat config that switches the rule on also applies `linterOptions.noInlineConfig`, so the attempt is ineffective as well as reported. It forbids a guard that a directive inside the reported file can switch off |
| `LINT-ESCAPE-3` | The pressure moves out of the file and into the config | A legitimate case is expressed in shared configuration or a closed type, and debt is fixed before merge. It forbids a path, folder, vendor or component allowlist, and a warning-level architectural rule |

`LINT-ESCAPE-1` and `LINT-ESCAPE-2` are two halves of one fence and neither substitutes for the
other: one explains the failure, the other guarantees the directive cannot silence its own guard. A
repository holding only the first reports a bypass that worked.

The numbering is fixed and cited from outside this module. A code is never renumbered to close a gap
in the sequence.

## Reading an accepted shape

1. Read what the shape states. It states that a rule exists, at what level it ships, and which trees
   the repository lints. Those are settled facts; this pattern does not revisit them.
2. Read what the shape does not state, because that is what it does not resolve. A shape that names a
   rule does not say whether the resolved `linterOptions` reached the config that switched it on, and
   it does not say whether a later block narrowed the rule's reach. Neither is decided here by
   assumption — each is a separate code with its own evidence.
3. Resolve outermost first. Configuration decides whether a rule runs at all before the rule runs, so
   settle `LINT-ESCAPE-3` and `LINT-ESCAPE-2` — the reach and the options of the resolved config —
   before judging the comment text inside a file under `LINT-ESCAPE-1`.
4. Ask each code's question in turn. For `LINT-ESCAPE-1`: if this comment were deleted, would the
   code go red? For `LINT-ESCAPE-2`: could a comment placed correctly switch off the very rule
   reporting that line? For `LINT-ESCAPE-3`: does what I am about to add to the config state a *case*
   or state a *name*?
5. When two codes both match, they are not competing — both are open, and both must be resolved.
   `LINT-ESCAPE-1` is text inside source; `LINT-ESCAPE-2` is a condition of the config that makes
   that text ineffective. Deleting every directive while the config still honours inline config
   leaves code 1 green and the fence unbuilt. `LINT-ESCAPE-1` is one file exempting itself;
   `LINT-ESCAPE-3` is the whole repository pre-building an exemption so nobody has to write a
   directive at all — code 3 is the more dangerous of the two because it leaves no trace in any file.

## `LINT-ESCAPE-1` — product source holds no directive

**Situation.** A file meets a rule that blocks it. The cheapest move is one comment line that
silences the rule — and that move always works, which is why it is the one most often chosen. What it
changes is not a line of code: it moves the power of judgement from the repository into the very file
that just violated it. What makes this code hard to see is that it *looks like a technical action*
while it is a governance action. Two reviewers on a PR carrying `eslint-disable-next-line` will
debate whether the reason beside it is sound. The real question is not there: from the moment that
line exists, nobody outside that file can answer whether the rule applies to it.

**What it emits in source.** A single published rule, `no-inline-lint-config`, living in
`@canon-fe`. It walks every comment in a product file via a `Program()` visitor
over `getAllComments()` rather than matching source text, and reports any comment whose body begins
with a directive. The pattern is `INLINE_DIRECTIVE`, anchored at the start of the comment body.
`isProductSource` is the only path condition in the file. The twin test in
`@canon-fe` carries the valid cases that keep prose about a directive
legal, with the comment explaining why the pattern is anchored and what the unanchored version cost.
Product source itself emits nothing: no directive comment of any form.

**Recognition signs.** A comment opening with `eslint-disable`, `eslint-disable-next-line`,
`eslint-disable-line` or `eslint-enable` in a shipping file. An `eslint-disable` at the top of a
file — the whole file leaves the law, and the next reader does not know which set of rules they are
reading under. A paired `eslint-disable` … `eslint-enable` wrapping a block, meaning somebody
*designed* an exempt region rather than slipped. A very carefully written reason beside the
directive: the more careful the reason, the more suspect it is, because it is evidence the author
knew they were going around. Somebody saying "it is only one line", "leave it for now and fix later",
"just to make the demo merge".

**Boundary.** This is not `LINT-ESCAPE-2`: code 1 is about text inside source, code 2 is about the
condition of the config that makes that text ineffective — delete every directive while the config
still allows inline config and code 1 is green with the fence still unbuilt. This is not
`LINT-ESCAPE-3`: code 1 is one file exempting itself, code 3 is the whole repository pre-building an
exemption so nobody has to write a directive, which is more dangerous because it leaves no trace in
any file. And it is not prose about a directive: a comment explaining *why this file has no*
`eslint-disable` is legal, because a directive is read from the first non-space character of a
comment and naming it mid-sentence is not commanding anything.

**Common business situations.** Declaration syntax for an external library · an `any` waved through
to make a deadline · a hook dependency warning · a `console` in a debug branch · a file that looks
generated · a component "we will rewrite next week" · a half-finished migration · a midnight hotfix
PR.

## `LINT-ESCAPE-2` — the resolved config makes a directive ineffective

**Situation.** A rule that reports a directive is **not enough**. If the config still honours inline
config, that directive still works — even when it is aimed at the very rule guarding it. At that
point the fence has a gate, and the key is in the hand of the person who wants to walk through. So
code 2 is not a "stricter" option. It is the thing that changes the outcome from *treated as wrong*
to *does not happen*. Both are needed: code 1 explains why it fails, code 2 guarantees the directive
cannot gag its own guard.

**What it emits in source.** `linterOptions` in `@canon-fe`, frozen and
exported beside `rules` so the two cannot be attached separately by accident, and re-exported from
the aggregate plugin `@canon-fe` so a consuming config takes them from the same import as
the rules. The twin test's second case emits the proof: a real linter, the frozen options applied, a
disable naming the guard itself, and the assertion that the guard still reports at severity `2`. This
code is held at tier `documented`, not `enforced`: nothing checks that a consuming config actually
spread the options. `refusesInlineConfig` can be read from the printed config, but this tree ships no
script that measures it in a real repository. The consuming repository therefore owes that proof.

**Recognition signs.** A config attaching `plugins` and `rules` with no `linterOptions` anywhere.
`linterOptions` present in the first block and then overwritten by a later one — flat config takes
the later block, and nobody notices because the rule is still in the list. Rule and linter options
imported from two different places, so one can be attached while the other is forgotten. A PR adding
`eslint-disable <name-of-the-directive-guard-rule>` with CI still green. Somebody answering "but the
rule is on" when asked whether directives still work.

**Boundary.** This is not `LINT-ESCAPE-1`, which is the text inside source rather than the condition
of the config. And it is not the `lint-adoption` law: code 2 says the artifact must **publish** the
linter options and that they must leave canon together with the rule. **Measuring whether a specific
repository received them** is `LINT-ADOPTION-4` in that other module, read from `refusesInlineConfig`
on the printed config. The two codes look at the same value from two sides: the publishing side and
the consuming side. `LINT-ESCAPE-2` is anchored for what the artifact PUBLISHES and **not yet
anchorable** for what a consuming repository RESOLVES: no file in this module observes whether the
options arrived.

**Common business situations.** A new repo wiring for the first time · adding a config block for a
test folder · merging two config files · upgrading ESLint to a new major · copying a config block
from another project · somebody adding their own `linterOptions` for a narrow glob.

## `LINT-ESCAPE-3` — no allowlist

**Situation.** When the directive is blocked, the pressure does not disappear — it moves. The next
place is the **config**: ask for a path to be exempt, a folder to be `ignores`d, a rule dropped to
`warn` "during the transition". The result is identical to code 1, except it leaves no trace in any
file, so nobody reading the code can see it. A thin component, a vendor boundary, a declaration file,
a file that looks generated, a temporary migration — none of them **earns** a local exemption.
Legitimate syntax is stated **once**, in shared configuration or a closed type, where every call site
inherits it and a reviewer can see it. Debt is paid before merge, not hidden beside where it arose.
An architectural rule at `warn` is the same story told differently: new violations still merge while
it looks governed. The weaker architecture always wins, because it is the one that blocks nobody.

**What it emits in source.** `schema: []` in the rule meta of `@canon-fe`,
which closes the rule to options so no allowlist can be configured *into* it, and `recommended`
publishing exactly one entry at exactly one level with no path key — there is no field an exemption
could be written into. In `@canon-fe`, `recommended` is gathered from every module with no
per-module discretion over level, and a published rule is never renamed; those are the two places a
per-path or per-name carve-out would have to live. A legitimate case emits an addition to the shared
matcher or a closed type, with its twin test, never a per-file exemption. This code is held at tier
`documented`: `schema: []` closes the rule to options, and nothing at all holds an allowlist built
*around* it out of a later config block.

**Recognition signs.** A `files`/`ignores` in the config named after exactly one component or exactly
one folder. A later config block lowering a rule's level for a "legacy" or "temporary" glob. An
architectural rule described as "still rolling out, `warn` this week". Somebody proposing an option
on the rule so the rule skips a list of paths. An architectural finding handled by changing the
rule's scope instead of fixing the boundary it found. A glob narrowed to exactly the place that just
went red.

**Boundary.** This is not `LINT-ESCAPE-1`, which is a file exempting itself and leaves a trace in
source. It is not the repository's own glob: which source trees the law applies to is still the
repository's fact — a monorepo and a single app do not share a folder layout — and that opens nothing
for a file **inside** the governed trees. It is not rule repair either: stating a legitimate case in
the shared matcher is **changing the law**, and it is reviewed as changing the law. That is the only
legal way out, and it is deliberately more expensive than one comment line. `LINT-ESCAPE-3` is
anchored against an allowlist configured into the rule and **not yet anchorable** against one built
around it — a later `ignores`, an override block, a glob narrowed by hand.

**Common business situations.** A thin component caught by an architectural rule · a folder produced
by codegen · a `.d.ts` declaring an external library · a source tree mid-migration · a new rule
turning 40 files red at once · a deadline · somebody wanting to "ramp it up gently".

## Layer held

Which tier actually holds each code — `unrepresentable` (a closed union or branded type makes the
wrong value impossible to write), `enforced` (a lint rule from `@canon-fe`
catches it, named here), or `documented` (nothing mechanical holds it; only a reader does).

| Code | Tier | What actually holds it |
|---|---|---|
| `LINT-ESCAPE-1` | `enforced` | `no-inline-lint-config`, the single rule this module publishes: it walks every comment in a product file and reports any whose body begins with a directive |
| `LINT-ESCAPE-2` | `documented` | The frozen `linterOptions` export, plus the twin test that runs a real linter and watches a disable aimed at the guard fail to land — but nothing checks that a consuming config actually spread it. The check that would, `refusesInlineConfig`, belongs to the `lint-adoption` module and is a script |
| `LINT-ESCAPE-3` | `documented` | `schema: []` on the rule, which closes it to options, so no allowlist can be configured *into* the rule — and nothing at all for an allowlist built *around* it out of a later config block |

One row is `enforced` and two are `documented`, and the split is not an accident of effort. The one
code an ESLint rule can hold is the one whose evidence is text inside a file. The other two are facts
about the resolved configuration: whether an option was set, whether a later block removed a path
from the rule's reach. A rule runs *inside* that configuration, after it has already decided whether
the rule runs at all — so the rule is structurally the wrong instrument, and its failure mode is
silent, because a rule switched off for a folder reports nothing and the folder lints clean. Writing
`enforced` on those two rows would put the comfortable answer in the column that exists to carry the
uncomfortable one.

## Anchor

A law that cannot be pointed at in real code is a proposal. One row per code, with the path and what
to look for there.

| Code | Path | What to look for |
|---|---|---|
| `LINT-ESCAPE-1` | `@canon-fe` | `INLINE_DIRECTIVE`, anchored at the start of the comment body; the `Program()` visitor walking `getAllComments()` rather than matching source text; and `isProductSource`, the only path condition in the file |
| `LINT-ESCAPE-2` | `@canon-fe` | `linterOptions`, frozen and exported beside `rules` so the two cannot be attached separately by accident. **Partial anchor** — see below |
| `LINT-ESCAPE-3` | `@canon-fe` | `schema: []` in the rule meta, and `recommended` publishing exactly one entry at exactly one level with no path key — there is no field an exemption could be written into. **Partial anchor** — see below |

Secondary evidence, useful when the primary anchor is being changed:

- `LINT-ESCAPE-1` — `@canon-fe`: the valid cases that keep prose about a
  directive legal, with the comment explaining why the pattern is anchored and what the unanchored
  version cost.
- `LINT-ESCAPE-2` — the same twin test's second case: a real linter, the frozen options applied, a
  disable naming the guard itself, and the assertion that the guard still reports at severity `2`.
- `LINT-ESCAPE-2` — `@canon-fe`: the options re-exported from the aggregate plugin, so a
  consuming config takes them from the same import as the rules.
- `LINT-ESCAPE-2` — the printed effective config: `refusesInlineConfig` is the value to retain. No
  script in this tree currently measures it in a real repository.
- `LINT-ESCAPE-3` — `@canon-fe`: `recommended` gathered from every module with no
  per-module discretion over level, and the refusal to rename a published rule — the two places a
  per-path or per-name carve-out would have to live.

`LINT-ESCAPE-2` is anchored for what the artifact PUBLISHES and **not yet anchorable** for what a
consuming repository RESOLVES: no file in this module observes whether the options arrived.
`LINT-ESCAPE-3` is anchored against an allowlist configured into the rule and **not yet anchorable**
against one built around it — a later `ignores`, an override block, a glob narrowed by hand. Both are
recorded as open risks.

## Inputs

| Input | Evidence required |
|---|---|
| file | Path of the file being judged, and whether it is product source or a fixture |
| comments | The comment bodies, read from the first non-space character, not the source text |
| config | The resolved `linterOptions`, and any later block that touches them or the rule's reach |
| case | The syntax or situation the bypass was defending, stated as a case rather than as one file |
| severity | The level the rule resolved to |

## Rules

1. An escape hatch is text that changes the set of laws applying to the file containing it.
2. A rule is repository policy; the file it reports is not a party to the decision. Product source
   contains no inline ESLint directive.
3. Reporting the attempt and making it ineffective are two obligations, not one; missing one means
   there is no fence.
4. A reason written beside a bypass documents it; it never authorises it.
5. A directive is read from the first non-space character of a comment and nowhere else, so prose
   about a directive is not a directive.
6. A legitimate case is represented in shared configuration or a closed type, never in a per-file
   exemption.
7. An architectural rule ships at `error` with a twin test, or it does not ship.
8. Debt is fixed before merge rather than hidden beside it.
9. Correcting a wrong rule is a repair for everyone, in the rule; it is never a local suspension.
10. The absence of a lint rule for a code is a stated gap, never a downgrade of the code.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **Prose about a directive.** Applies to `LINT-ESCAPE-1`. It governs directives, not the word. A
  comment explaining why a file carries no `eslint-disable` is the most useful comment on the subject
  a file can hold, and the pattern is anchored so that writing it stays legal. Under-catching is not
  the trade: a directive the linter would obey always sits at the start of the comment.
- **Fixtures that construct the forbidden text.** Applies to `LINT-ESCAPE-1`. The rule's twin tests
  build directives on purpose. A fixture is the string, not the act, and the rule's own path gate is
  what keeps the distinction from needing a directive to express it.
- **Globs are where, not who.** Applies to `LINT-ESCAPE-3`, which refuses an allowlist. Which trees a
  repository lints is still the repository's own fact — a monorepo and a single app do not share a
  folder layout. That opens nothing for a file inside the governed trees, and a glob narrowed to
  route around one violation is an allowlist wearing a config's clothes.
- **Shared configuration owning legitimate syntax.** Applies to `LINT-ESCAPE-3`. A vendor
  declaration, a generated shape or a platform requirement can be legal. The code requires that
  legality to be stated once, as a semantic case in the shared matcher or a closed type, where every
  call site inherits it and a reviewer can see it. Stating it in the file that needs it is the bypass
  under another name.
- **Repairing the rule is not an exemption.** Applies to all three codes. When the rule is wrong, the
  matcher or the architecture is corrected. The repair lands in the shared artifact with its twin
  test, not beside the violation — and it is reviewed as a change to the law, because it is one. It
  is deliberately more expensive than one comment line.

## Output

One block per file the shape produces.

```text
file: <path judged, product source or fixture>
directive: <the comment body, or none>
situation: <LINT-ESCAPE-1 | LINT-ESCAPE-2 | LINT-ESCAPE-3>
holder: <enforced | documented>
verdict: <legal | stop>
repair: <shared rule | closed type | shared config | architecture>
```

## Worked example

The accepted shape: a repository has decided to ship an architectural rule at `error`, and one thin
product component fails it, so the component carries `/* eslint-disable-next-line */` with a careful
reason beside it while the flat config attaches `plugins` and `rules` from the plugin import.

```text
file: src/components/thin-card.tsx
directive: eslint-disable-next-line
situation: LINT-ESCAPE-1
holder: enforced
verdict: stop
repair: shared rule
```

The fact that excludes `LINT-ESCAPE-3` here is that the exemption is written inside the product file
itself, leaving a trace in source; code 3 is the repository pre-building an exemption in
configuration, which leaves no trace in any file. The reason written beside the directive documents
it and does not authorise it, so it changes nothing in this verdict.

```text
file: eslint.config.mjs
directive: none
situation: LINT-ESCAPE-2
holder: documented
verdict: stop
repair: shared config
```

The fact that excludes `LINT-ESCAPE-1` is that no comment body is involved at all: the finding is a
condition of the resolved configuration — `linterOptions.noInlineConfig` is absent from the block
that switched the rule on — so a directive aimed at the guard itself would still land. Deleting the
directive in the component would leave code 1 green and this fence still unbuilt.

What the shape does not state, and therefore does not resolve: it does not say whether a later config
block narrowed the rule's reach or lowered its level for a glob, so `LINT-ESCAPE-3` is not resolved
by this shape and must be read from the resolved configuration. It also does not say whether a
consuming repository actually spread the published options — nothing in this module observes that,
and the check that would, `refusesInlineConfig`, belongs to the `lint-adoption` module.

## Scope

This rule holds for any front end that lints, for any code of this kind in this stack. It names no
product, no component library and no repository, and no single feature. Every example is an ordinary
flat config and ordinary TSX; the plugin namespace in the examples is a placeholder, and the law does
not change when it is spelled differently.
