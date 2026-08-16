---
id: be-patterns-comments-index
title: INDEX.md
slug: /be/patterns/comments
sidebar_label: comments
sidebar_position: 0
description: Binding rules for what a back-end comment must carry, which exports must open with one, and which prose is data rather than commentary.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `comments`

## Law

A comment answers the one question the code cannot: **why**. What the code does is already written in
the code, in a language designed for saying it precisely. Restating it in English produces a second
description of the same fact, and the second one has no compiler behind it — so it drifts the first
time the code changes and nobody edits the sentence beside it.

The question that settles whether a comment earns its place: **could a reader work this out from the
code in front of them?** If yes, delete it. If no — a constraint that lives outside this file, a
decision that looks arbitrary and is not, a bug this shape prevents — write it down, because it is
about to be lost.

Two consequences follow that a reader does not usually connect to the same law. An export must open
with a doc block, because the surface other files depend on is read at the import site by somebody
who will never open the file, and a name plus a signature says what it TAKES, never what it is for.
And an enum member must state the consequence of choosing it, because a member is picked at a call
site far from the switch that gives it meaning.

**This is binding, not advisory.** Every export, every enum member, every comment and every non-ASCII
character in the tree sits under exactly one of the codes below. There is no declaration too small to
carry one: a one-line arrow-function export answers `COMMENT-1` for the same reason a service class
does. "It is only a helper" is where this rule is skipped most often, and a helper is exactly the
symbol that acquires three callers before anybody re-reads it.

Three of the five codes have a lint rule behind them, and one of those three can only see half of
what its code asks. The `Tầng giữ` table below says which is which rather than implying uniform
enforcement.

What holds this law is [`sources/be/comments.mjs`](../../../sources/be/comments.mjs).

## Situation Codes

Every situation this module governs carries a code, `COMMENT-<n>`. The numbers are FIXED: they are
cited from sibling laws and from historical task records, so a renumber silently breaks a citation
somebody already made.

| Code | What it requires | What it forbids |
|---|---|---|
| `COMMENT-1` | Every export with a SURFACE — class, interface, type alias, enum, function, a const bound to a function — opens with a doc block naming what it is FOR and when to reach for it | An undocumented export that other files import; a doc block that only repeats the declared name |
| `COMMENT-2` | Every member of an exported enum carries its own doc, and that doc states the CONSEQUENCE of choosing the member | A member with no doc; a doc that restates the member's own name ("the pending state") |
| `COMMENT-3` | A comment carries a reason that lives OUTSIDE the line beneath it — a provider quirk, a schema constraint, an ordering that looks arbitrary, a bug this shape prevents | A sentence that re-describes the statement under it in English |
| `COMMENT-4` | Source prose is English, and carries no Vietnamese letter, no emoji and no ornamental symbol standing in for a word | A comment in a second language; an emoji or a check mark used as meaning; a banner drawn out of ornaments |
| `COMMENT-5` | Text the program MATCHES on or EMITS stays exactly as the program needs it, and the line carries a `vn-ok: <reason>` marker saying why it stays | Translating a literal the behaviour depends on; a bare `vn-ok` with no reason; using the marker to smuggle prose |

Five codes, and it ends at five. A situation that genuinely has no code is a rule change recorded in
`changelog.md`, not a sixth number added in passing.

`COMMENT-1` and `COMMENT-2` are the same sentence said about two different surfaces, and they stay
two codes because they fail differently and are held differently. An undocumented export is caught
whole by a rule; an enum member's doc can be seen to EXIST by a rule and can never be seen to state a
consequence. Collapsing them would hide exactly that asymmetry.

`COMMENT-4` is NOT "ASCII only", and the difference is the most-misread part of this module. It
refuses three character classes for three separate reasons — Vietnamese letters, emoji, ornaments —
and leaves typographic punctuation alone. An em dash, a middle dot and a box-drawing run in a comment
banner are none of the three things the law refuses, and a rule that bans them is a stricter law
being invented rather than this one being recorded.

## Tầng giữ

Which tier actually holds each code. `unrepresentable` means a closed union or branded type makes the
wrong value impossible to write; `enforced` means a lint rule in
[`sources/be/comments.mjs`](../../../sources/be/comments.mjs) catches it; `documented` means nothing
mechanical holds it and only a reader does.

| Code | Tier | What holds it |
|---|---|---|
| `COMMENT-1` | `enforced` | `require-export-jsdoc` (export `requireExportJsdoc`). Sees the ABSENCE of a doc block. Cannot see whether the doc says what the export is for |
| `COMMENT-2` | `enforced` | `require-enum-member-jsdoc` (export `requireEnumMemberJsdoc`). Sees that a member has a doc. The consequence half is read by a person, and the rule's own message says so |
| `COMMENT-3` | `documented` | — |
| `COMMENT-4` | `enforced` | `no-non-ascii-source` (export `noNonAsciiSource`). One rule for three character classes, so it cannot be satisfied by switching alphabets |
| `COMMENT-5` | `documented` | — |

**Three enforced, two documented, none unrepresentable.** The empty `unrepresentable` column is
structural rather than an omission: a comment is not a value. No closed union and no branded type can
make a false sentence unwritable, because the type system never reads the sentence. `/** The pending
state. */` type-checks in every position a true doc type-checks in. That is the whole reason this
module exists as prose.

Two of the three enforced rows are narrower than the code they hold, and the narrowness is the point
rather than an embarrassment:

- `require-export-jsdoc` deliberately skips a data constant. `export const MAX_ATTEMPTS = 3` is
  already fully described by its own name, and demanding a sentence there produces sentences that
  restate the name — which `COMMENT-3` forbids. Only a declaration with a surface is visited, and a
  const is visited only when it is bound to a function.
- `require-enum-member-jsdoc` holds the EXISTENCE half of `COMMENT-2` and none of the consequence
  half. A member documented as "the settled state" passes the gate and fails the law.

Both `documented` rows and both enforcement gaps are named again in `audit.md` under
"Rủi ro còn mở", with what a rule would have to be able to SEE in order to hold them — and, for two
of them, why no rule can.

## Anchor

Real code each law can be checked against. A law that cannot be pointed at is a proposal.

| Code | Anchor | What to look for |
|---|---|---|
| `COMMENT-1` | `src/modules/databases/postgresql/primary/primary.decorators.ts` → `InjectPrimaryPostgreSQLEntityManager` | A one-line arrow-function export whose doc block is three lines long, because the whole risk is invisible in the signature: the wrong connection has the identical type and reads the wrong data. This is the anchor for "no declaration is too small" |
| `COMMENT-1` | `src/modules/databases/postgresql/primary/constants/connection.ts` | The other side of the same rule: a plain data constant, no doc block, no finding. Read it beside the decorator to see where the rule's exemption is drawn |
| `COMMENT-2` | `src/modules/ai/balancer/enums/ai-error-kind.ts` → `AiErrorKind` | Four members, four consequences — hard-disable the key, short cooldown, light cooldown, do not penalize. None of the four is derivable from the member's name, and each is chosen at a call site far from the switch that acts on it |
| `COMMENT-2` | `src/modules/ai/balancer/enums/key-status.ts` | A second enum in the same folder, so the pair shows the shape holding across a family rather than in one lucky file |
| `COMMENT-3` | `src/modules/bussiness/streak/streak-freeze-cron.service.ts` (the insert-and-spend block) | The clearest live example of a reason that lives outside the line: why `RETURNING id` is read at all, why zero affected rows means the provisional row must be removed rather than retried, and why a racing replica is the case being defended against. Delete those sentences and the code still compiles and stops being explicable |
| `COMMENT-4` | `eslint.config.mjs` (the rule block wiring the back-end plugin) | Where this code is switched on for the whole tree, at `error`. Also the anchor for the drift recorded in `audit.md`: the consuming config still wires three legacy rules that canon replaced with one |
| `COMMENT-4` | `src/tests/harness/ai-tutor.harness-spec.ts` | The fixture lane, rendered: a Vietnamese instruction is the fixture's entire point, and the file's prose is still English. This is the boundary between "prose in a second language" and "data that happens to be prose" |
| `COMMENT-5` | `src/features/api/core/graphql/queries/contents/content/content.handler.ts` (the heading regex, `vn-ok` marked) | A pattern MATCHED against real authored content. Translate the literal and the branch stops matching anything, silently — no test fails on a regex that simply never fires |
| `COMMENT-5` | `src/features/api/core/graphql/mutations/**/*.resolver.ts` (the per-locale success messages) | The EMIT side of the same code, repeated across the whole mutation surface with a one-clause reason on every line. Read it as the volume test: the marker only survives being written hundreds of times because it carries a reason each time |

Every code is anchored. None reads `chưa neo được`.

## Inputs

| Input | Evidence required |
|---|---|
| declaration | What is being declared, and whether it has a surface other files depend on |
| export | Whether it leaves the file, and whether it is a re-export with nothing to attach a doc to |
| reason | The fact that lives outside the line: a provider quirk, a schema constraint, a race, an ordering |
| consequence | For an enum member: what CHOOSING it causes downstream, not what it is named |
| audience | A reader who does not share the author's first language and will not open this file |
| dependence | Whether the program MATCHES on or EMITS the literal, which decides prose from data |
| lane | Whether the file is a locale file, a fixture lane, or ordinary source |

## Invariants

- Every export with a surface opens with a doc block.
- Every member of an exported enum carries a doc, and that doc states a consequence.
- A comment says why; the code says what.
- Source prose carries no Vietnamese letter, no emoji and no ornament standing in for a word.
- A literal the program depends on is never translated, and never left unmarked.
- A `vn-ok` marker carries a reason; a bare marker is not an exemption.
- A doc block that restates the declared name is a `COMMENT-3` violation wearing a `COMMENT-1` shape.
- Every export, member and comment resolves to exactly one code. Nothing is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **A data constant has no surface.** `COMMENT-1` does not touch `export const MAX_ATTEMPTS = 3`.
  The name already is the description, and a required sentence beside it would restate the name.
- **A re-export has nothing to document.** `export { X } from "./x"` declares nothing, so there is no
  node for a doc block to describe. The doc belongs at the declaration.
- **Typographic punctuation stays.** `COMMENT-4` refuses Vietnamese letters, emoji and ornaments. An
  em dash, a middle dot, an ellipsis and a box-drawing banner are none of those, and the codebase has
  used them deliberately for its whole life.
- **The language's own name is a label.** `Tiếng Việt` written as the NAME of a locale is an
  identifier, not prose in that language, and is exempt from `COMMENT-4`.
- **A locale file is product copy.** A file under `messages/`, `locales/` or `i18n/` is wholly
  `COMMENT-5` by construction; policing it would be policing the product, so `COMMENT-4` is not
  applied there at all.
- **In a fixture lane, a string is data and a comment is still prose.** In a spec or under the test
  tree, `COMMENT-4` polices comment lines only. A spec that feeds a system the sentence a real user
  would type is feeding it data, and translating it would test a system nobody uses. A comment in a
  second language is refused there exactly as it is everywhere else.

## Output

```text
declaration: <the exported symbol, member, or the line the comment sits above>
path: <folder/file>
situation: <COMMENT-1 … COMMENT-5>
reason: <the fact that lives outside the line, or the consequence of choosing this member>
lane: <source | fixture | locale>
marker: <none | vn-ok: reason>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.
`changelog.md` is read when a version marker disagrees with what a record says.

## Scope

This module states a rule true of any back end whose code outlives the author's memory of writing it.
Examples are ordinary TypeScript in a NestJS-shaped application: they name no product, no repository
and no course. The rule ids are the only proper nouns in the law itself, because a rule id is an
enforcement identity and a renamed rule cannot be cited in a config. Repository paths appear in
`Anchor` and nowhere else — an anchor is required to be a real path, which is exactly what makes it
an anchor.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
Adding, removing or renumbering a `COMMENT-<n>` code is a major change, not an increment.
