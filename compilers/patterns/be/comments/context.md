---
title: Comments
runtime: true
source: en.md
sourceHash: e35f5ec7d85ff00508f45c7429172d36cbe98a0a788165d03b1b1bc7a50fb2e8
contextVersion: 1
---

# Comments

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | the published backend machine this record cites |

## Record

The input to this pattern is a shape already accepted: a module boundary, a capability, a contract, an
enum, an export somebody has already decided belongs. This pattern does not re-open that decision. Its
output is source architecture — which declaration opens with a doc block, what that block must say,
which line carries a reason, which prose is written in English, which string is data that must stay
exactly as it is and carry a marker saying why.

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
what its code asks. The layer table below says which is which rather than implying uniform
enforcement.

What holds this law is `@canon-be`.

## Situation codes

Every situation this module governs carries a code, `COMMENT-<n>`. The numbers are FIXED: they are
cited from sibling laws and from historical task records, so a renumber silently breaks a citation
somebody already made.

| Code | Situation | What the source must look like |
|---|---|---|
| `COMMENT-1` | Something leaves the file and another file imports it | Every export with a SURFACE — class, interface, type alias, enum, function, a const bound to a function — opens with a doc block naming what it is FOR and when to reach for it. Never an undocumented export that other files import; never a doc block that only repeats the declared name |
| `COMMENT-2` | An enum member is chosen at a call site, far from where its meaning is decided | Every member of an exported enum carries its own doc, and that doc states the CONSEQUENCE of choosing the member. Never a member with no doc; never a doc that restates the member's own name ("the pending state") |
| `COMMENT-3` | There is a reason living OUTSIDE the line of code | A comment carries a reason that lives OUTSIDE the line beneath it — a provider quirk, a schema constraint, an ordering that looks arbitrary, a bug this shape prevents. Never a sentence that re-describes the statement under it in English |
| `COMMENT-4` | The next reader does not share the author's first language | Source prose is English, and carries no Vietnamese letter, no emoji and no ornamental symbol standing in for a word. Never a comment in a second language; never an emoji or a check mark used as meaning; never a banner drawn out of ornaments |
| `COMMENT-5` | A string the program MATCHES on or EMITS | Text the program matches on or emits stays exactly as the program needs it, and the line carries a `vn-ok: <reason>` marker saying why it stays. Never translate a literal the behaviour depends on; never a bare `vn-ok` with no reason; never use the marker to smuggle prose |

Five codes, and it ends at five. A situation that genuinely has no code is a rule change recorded in
the changelog, not a sixth number added in passing.

`COMMENT-1` and `COMMENT-2` are the same sentence said about two different surfaces, and they stay
two codes because they fail differently and are held differently. An undocumented export is caught
whole by a rule; an enum member's doc can be seen to EXIST by a rule and can never be seen to state a
consequence. Collapsing them would hide exactly that asymmetry.

`COMMENT-4` is NOT "ASCII only", and the difference is the most-misread part of this module. It
refuses three character classes for three separate reasons — Vietnamese letters, emoji, ornaments —
and leaves typographic punctuation alone. An em dash, a middle dot and a box-drawing run in a comment
banner are none of the three things the law refuses, and a rule that bans them is a stricter law
being invented rather than this one being recorded.

## Reading an accepted shape

1. **Read what the shape states.** It names the declarations that exist: which symbols leave the file,
   which of them have a surface, which enums are exported and what members they carry, which lines
   depend on a fact from outside the file.
2. **Read what the shape does not state, and therefore does not resolve.** An accepted shape never
   states the sentence that goes in a doc block, never states the consequence of choosing a member,
   and never states the reason a line is written the way it is. Those are supplied here, from the
   `reason` and `consequence` inputs, or the pattern does not resolve.
3. **Resolve outermost first.** Take the declaration before its members: settle `COMMENT-1` for the
   enum as a whole, then `COMMENT-2` for each member. Settle the file's lane before judging a single
   line, because the lane decides whether `COMMENT-4` applies at all.
4. **Ask each code's question in order.** Does this leave the file with a surface (`COMMENT-1`)? Is it
   a member of an exported enum (`COMMENT-2`)? Does this line need a fact from outside itself
   (`COMMENT-3`)? Is this prose, and what is it written in (`COMMENT-4`)? Does the program match on or
   emit this literal (`COMMENT-5`)?
5. **When two codes both match, they are asking different questions and both hold.** A doc block that
   restates the declared name satisfies `COMMENT-1`'s shape and violates `COMMENT-3`; write it once so
   both are answered. A Vietnamese sentence explaining a race is a `COMMENT-4` violation and not a
   `COMMENT-3` one. What decides between `COMMENT-4` and `COMMENT-5` is never the alphabet — it is
   whether the program depends on the literal.

## `COMMENT-1` — every export opens with a doc block

**Situation.** A class, interface, type, enum, function, or a `const` bound to a function — something
with a SURFACE — is exported. This is the part other files depend on, and the person deciding whether
to use it usually never opens this file. They see the name at the import line and the signature on
hover.

**What it emits in source.** A doc block immediately above the exported declaration, stating what the
symbol is FOR and when to reach for it rather than the thing sitting next to it. A name plus a
signature says what it TAKES; it never says what it is for.

**Boundary.** This is NOT the data-constant case: `export const MAX_ATTEMPTS = 3` does not belong to
this code, because the name already is the full description and demanding a sentence beside it only
produces a sentence that restates the name — which `COMMENT-3` forbids. It is NOT the re-export case:
`export { X } from "./x"` declares nothing, so there is no node to attach a doc to, and the doc belongs
at the declaration. And it is NOT `COMMENT-3`: a doc block that merely copies the name does not
satisfy this code — it passes the lint gate and breaks the law, the single most common violation in
this module.

## `COMMENT-2` — every enum member states the consequence of choosing it

**Situation.** An enum is exported. Its members are chosen AT A CALL SITE, while the meaning of a
member lives in a `switch` or a lookup table IN ANOTHER FILE. The person writing the call site does not
open that other file.

**What it emits in source.** A doc block on each member answering: choosing this, what does the system
do? `Pending` documented as "the pending state" teaches nothing. "No payment has settled, so no access
is granted and the cart is still editable" is the fact the next author needs and cannot derive.

**Boundary.** This is NOT `COMMENT-1`: `COMMENT-1` documents the WHOLE enum — what the enum is for;
this code documents EACH member — what choosing it causes. An enum with a doc on top and empty members
still violates. And it is NOT `COMMENT-3`: a doc restating the member's name (`/** The settled state.
*/`) is a `COMMENT-3` violation even while the lint gate is green.

## `COMMENT-3` — a comment says why, the code says what

**Situation.** A reason living OUTSIDE the line forces the line to be written that way: an external
system that sends a webhook twice, a schema constraint, an ordering that looks arbitrary and is not, a
bug this shape prevents, a race between two replicas.

**What it emits in source.** A sentence above the line carrying that outside fact — and nothing that
re-describes the statement below it. A comment that copies the line beneath it is WORSE than no
comment: it doubles the maintenance cost and becomes the part that silently goes wrong, because
nothing breaks when a sentence stops being true.

**Boundary.** This is NOT `COMMENT-1` in the sense of being satisfied by its gate: an export's doc
block must satisfy this code too — "Inject the primary entity manager" above
`InjectPrimaryEntityManager` copies the name, so the doc exists and is still wrong. And it is NOT
`COMMENT-4`: this code asks what the comment SAYS, `COMMENT-4` asks what it is WRITTEN IN. A Vietnamese
sentence explaining a race violates `COMMENT-4`, not this one.

## `COMMENT-4` — source prose is English, no emoji, no ornament

**Situation.** Not because English is better. A codebase with TWO languages is a codebase with at least
one reader for whom HALF the reasoning is unreadable — and it is exactly the half explaining the
surprises. The obvious parts everyone reads from the code; the parts that needed a comment are the
parts that get lost.

**What it emits in source.** English prose in every comment, log message, variable name and internal
exception message. Emoji and ornamental symbols are refused for a different reason: they carry TONE
rather than INFORMATION, and tone is read differently by every reader. A check mark in a comment cannot
say whether it means "checked", "done" or "correct".

This is NOT "ASCII only" — the most misread part of the module. The law refuses THREE character
classes, each for its own reason: (1) Vietnamese letters, because a reader without that first language
loses half the argument; (2) emoji, because they carry tone instead of information; (3) an ornamental
symbol standing in for a word — a tick, a cross, an arrow used decoratively — for the same reason as
emoji. Typographic punctuation (em dash, middle dot, ellipsis, box-drawing in a banner comment) is none
of those three and STAYS. The first version of the rule banned every non-ASCII codepoint; measured on a
real back end it reported 857 sites — and ALL of them were em dashes, box drawing or middle dots. That
is not this law being recorded, it is a stricter law being invented, and inventing law is the one thing
canon may not do.

**Boundary.** This is NOT `COMMENT-5`, and that is the most important boundary in the module: this code
governs PROSE, `COMMENT-5` governs DATA that happens to be shaped like prose. A Vietnamese sentence the
program MATCHES on or EMITS is not a comment, and translating it breaks the program. It is NOT the
fixture lane: in a spec or under the test tree a STRING is data while a comment is still prose — a spec
feeding the system the exact sentence a real user would type is feeding it data, and translating it
would test a system nobody uses. Measured before this exception was written: of 92 findings in one back
end, 89 were fixture strings and 3 were comments; marking all 92 means putting a marker on every line
of every fixture conversation, which teaches the reader to stop seeing markers. And it is NOT the
locale lane: files under `messages/`, `locales/` or `i18n/` are wholly product copy, and policing them
would be policing the product. Nor is it the endonym case: `Tiếng Việt` written as the NAME of a locale
is a label, not prose in that language, and is exempt.

## `COMMENT-5` — a string the program depends on is not a comment

**Situation.** A Vietnamese string sits in the source, but it is NOT a developer speaking to a
developer. It is DATA: a per-locale message returned to the client, a string an external system sends
that we compare against, a pattern matched against content real users wrote, a label a model is
required to emit verbatim, a fixture reproducing exactly the sentence a user will type.

**What it emits in source.** The literal, unchanged, with a `vn-ok: <reason>` marker on the line saying
why it stays — so the next sweep does not "fix" it into a bug. Translating these breaks the program in
the worst way: SILENTLY. A mistranslated regex throws nothing, it simply never matches again. A
mistranslated comparison branch never turns red, it just never becomes true again.

**Boundary.** This is NOT `COMMENT-4`: prose gets translated, data is kept and marked. It is NOT the
empty marker: a `vn-ok` with NO reason is not an exception — the marker exists so the next sweep can
read why the line stays, and without a reason it is only a way of switching the gate off. And it is NOT
a licence to keep a comment: using `vn-ok` to preserve a Vietnamese COMMENT turns the exception into a
hole. This exception is for STRINGS, not for explanations.

## Layer held

Which tier actually holds each code. `unrepresentable` means a closed union or branded type makes the
wrong value impossible to write; `enforced` means a lint rule in `@canon-be` catches it;
`documented` means nothing mechanical holds it and only a reader does.

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

Both `documented` rows and both enforcement gaps remain open risks, with what a rule would have to be
able to SEE in order to hold them — and, for two of them, why no rule can.

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

## Rules

1. Every export with a surface opens with a doc block.
2. Every member of an exported enum carries a doc, and that doc states a consequence.
3. A comment says why; the code says what. A sentence copying the line below it is deleted.
4. Source prose carries no Vietnamese letter, no emoji and no ornament standing in for a word.
   Typographic punctuation stays.
5. A literal the program depends on is never translated, and never left unmarked: it keeps its exact
   form and carries `vn-ok: <reason>`.
6. A `vn-ok` marker carries a reason; a bare marker is not an exemption.
7. A doc block that restates the declared name is a `COMMENT-3` violation wearing a `COMMENT-1` shape,
   even while the lint gate is green.
8. Every export, member and comment resolves to exactly one code. Nothing is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **A data constant has no surface.** `COMMENT-1` does not touch `export const MAX_ATTEMPTS = 3`.
  The name already is the description, and a required sentence beside it would restate the name.
- **A re-export has nothing to document.** `export { X } from "./x"` declares nothing, so there is no
  node for a doc block to describe. The doc belongs at the declaration. Applies to `COMMENT-1`.
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

One block per file the shape produces.

```text
declaration: <the exported symbol, member, or the line the comment sits above>
path: <folder/file>
situation: <COMMENT-1 … COMMENT-5>
reason: <the fact that lives outside the line, or the consequence of choosing this member>
lane: <source | fixture | locale>
marker: <none | vn-ok: reason>
```
