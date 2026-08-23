---
title: Comments
description: Where prose lands in source — which position, which file, which language, and which code decides it.
module: comments
kind: pattern
---

# Comments

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | the published frontend machine this record cites |


## Record

The input to this pattern is a shape somebody already accepted: a component, a hook, a type, a rule
module, a locale dictionary, a fixture. That decision is closed here. What is still open is where the
prose goes — which export opens with a documentation block, which position may hold a second
language, which literal carries a mark, which sentence is deleted rather than improved. This pattern
takes the accepted shape and lands it as source architecture: the file, the position inside it, the
language, the mark, and the code that answers for it.

## Law

A comment is what the code cannot say about itself. The code already states what happens; a comment
states why it happens that way, what breaks without it, and which alternative was refused. Anything
that merely renames the line below it is noise, and noise trains a reader to skip the comment that
mattered.

Two questions settle everything here. **Would a stranger reach the same conclusion from the code
alone?** If yes, the comment is not needed. **Can a reader who does not share your first language
read it?** If no, it is not written yet.

The second question is the one this module is strictest about, and the bar is deliberately not
"English where convenient". The source is English-only, to a stranger's standard, and the exceptions
are three, narrow, and named.

**This is binding, not advisory.** The scope is not comments. It is every position in a source file
where prose can hide: block comments, line comments, identifiers, string literals, template chunks,
JSX text and diagnostic messages. A rule that reached only comments would leave the same sentence
legal one line lower as a variable name, which is where it goes the moment the rule arrives.

## Situation codes

Every situation this module governs carries a code, `COMMENTS-<n>`. The code names the SITUATION. The
codes are cited from other law files and from task records, so a number, once issued, is never reused
for a different meaning and never renumbered.

| Code | Situation | What the source must look like |
|---|---|---|
| `COMMENTS-1` | A declaration leaves the file | Every export opens with a documentation block naming the ROLE it plays. No export with no block; no block that restates the signature; no ceremony blocks on internal helpers |
| `COMMENTS-2` | Prose in any authoring position | Comments, JSDoc, identifiers and diagnostic messages in English, to a stranger's standard. No second language in any authoring position, including one line lower as a name |
| `COMMENTS-3` | The three closed exceptions | Locale content, exact fixtures and marked functional literals stay; the mark carries the reason. No unmarked functional literal in another language; no fourth exception argued per file |
| `COMMENTS-4` | A pictograph wants into the source | Generic interface marks come from the icon vocabulary; product reactions use attributed checked-in artwork through the reaction leaf. No Unicode pictograph in an identifier, comment, diagnostic or non-content string |
| `COMMENTS-5` | A comment restates its line | The comment is deleted. Not rewritten into a better restatement |
| `COMMENTS-6` | A comment has to argue | The comment names the decision: what was tried, what it cost, why the obvious shape is refused. No refusal recorded nowhere, where the next reader undoes it |

`COMMENTS-3` IS AN EXCEPTION CLAUSE, NOT A LICENCE. It is stated as a code so that a reader can cite
it, be corrected against it, and be shown to have got it wrong. An exception with no name is one
nobody can be argued out of.

## Reading an accepted shape

1. **Read what the shape states.** It states the declaration and its position: this is a component,
   this is a hook, this file is a locale dictionary, this literal is compared with `===`. Take the
   `site`, the `file`, the `binding` and the `runtime role` from the shape as given.
2. **Read what it does not state, and therefore does not resolve.** An accepted shape does not state
   whether a sentence carries information the line below it lacks, and it does not state which
   alternative was refused while the shape was chosen. Those two facts are not in the tree; they come
   from the author, and no code can be resolved from the shape alone. `COMMENTS-5` and `COMMENTS-6`
   are decided by a reader, never by the shape.
3. **Resolve outermost first.** File before position, position before sentence. A content path
   settles the language question for everything inside it before any single literal is examined; a
   `binding` settles whether a block is required before the block's wording is judged.
4. **Ask each code's question in order.** Is this exported, and does it open with a block naming its
   role? Is every authoring position English to a stranger's standard? Is this one of the three
   exceptions, and does the mark carry its reason? Is there a Unicode pictograph anywhere in an
   authoring position? Does this sentence say anything the line below does not? Does this sentence
   argue with a decision, and does it name it?
5. **When two codes both match**, the site does not split. Every prose site resolves to exactly one
   code. Presence and language are decided before quality: `COMMENTS-1` asks whether a block exists,
   `COMMENTS-5` decides whether the block that exists is kept. `COMMENTS-2` asks whether the line can
   be read; `COMMENTS-5` asks whether it is worth reading. `COMMENTS-3` overrides `COMMENTS-2` only
   by path and mark, never by judgement. If you find yourself wanting to write at length to defend a
   line, it stopped being `COMMENTS-5` and became `COMMENTS-6`.

## `COMMENTS-1` — every export opens with a documentation block

**Situation.** A thing that is `export`ed is a thing other files depend on. Its contract is read far
more often than it is written, and it is read by people who will never open the body. The
documentation block states the ROLE — what this is, what it is for, what the caller must do with the
result — and does not restate the signature, because the signature already states itself and cannot
go stale.

**What it emits in source.** A block above the exported declaration, in the file where the
declaration lives, naming the role. Internal helpers in the same file carry no such block. A
re-export line emits nothing: `export { X }` states a binding, and the contract belongs in the file
where `X` was declared.

**Recognition signs.** The keyword `export` stands before the declaration. Its callers live in
another file, usually in another layer. You have to open the body to learn what returning `null`
means.

**Boundary.** This is not `COMMENTS-5`. A block that copies the signature (`@param name - The name`)
IS a restatement; it falls to `COMMENTS-5` and is deleted, not "written better". `COMMENTS-1` demands
that a block exist; `COMMENTS-5` decides whether the existing block is kept. It is also not the
internal-helper case: requiring a block on every helper produces a file where half the lines are
ceremony, and then no block is read at all.

**Common business situations.** An exported component · a custom hook · a public type or interface ·
a configuration constant · a data-formatting function · an API adapter · a guard or validator · a
barrel file.

## `COMMENTS-2` — the source is English, to a stranger's standard

**Situation.** Comments, JSDoc, identifiers and diagnostic messages are all prose. The bar is not
"the team understands it" — the bar is a person who joins a year later and does not share the first
language of whoever wrote that line. Why so strict: a codebase in two languages has two readerships,
and the smaller one silently stops reading exactly the parts it cannot read. Nobody reports that.

**What it emits in source.** English in every authoring position of the file: comment, JSDoc,
identifier, string literal, template chunk, JSX text, diagnostic message. Moving a sentence out of a
comment and into a name does not translate it and does not exempt it, so the name is English too.

**Recognition signs.** Accented characters anywhere in an authoring file. A sentence that has just
been moved from a comment into a variable name, a function name or an object key. An error message
addressed to the person on call rather than to the person who wrote it.

**Boundary.** This is not `COMMENTS-3`: if the string is a value the running program matches on or
emits, it is not prose — it is data, and it stays, marked. It is not `COMMENTS-5` either:
`COMMENTS-2` asks whether the line can be read, `COMMENTS-5` asks whether it is worth reading, and an
English comment that copies the line below is still deleted. One honest gap belongs here: the rule
lets `Tiếng Việt` through — the endonym a language switcher is obliged to display in its own script —
while the law names only THREE exceptions. That divergence is recorded as a gap, not quietly promoted
into a fourth exception.

**Common business situations.** A comment explaining a local business rule · identifiers named after
domestic domain terms · the message inside a `throw` · logs · keys in a configuration object ·
hard-coded JSX text · strings inside a template literal.

## `COMMENTS-3` — three exceptions, each announcing itself where it applies

**Situation.** There are exactly THREE positions where a second language is not a defect. **Locale
content**: a translation dictionary IS the other language, and holding it to `COMMENTS-2` would empty
the product. **Test fixtures**: a fixture that reproduces a real string must reproduce it exactly, or
it is testing something else. **Functional literals**: a value the running program matches on or
emits is data, not prose; it stays, and it is marked on its own line with its reason.

**What it emits in source.** Either a file on a content path — a locale dictionary, a resources
directory, a fixture, a `.test.*` or `.spec.*` file — or a literal in an ordinary authoring file
carrying a mark on its own line, and the reason after that mark. The mark is the whole point of the
third exception: an unmarked literal is indistinguishable from a comment somebody forgot to
translate, so the reader has to guess, and the next reader guesses differently.

**Recognition signs.** The file sits on a content path. The string is compared with `===`, used as a
key, or sent straight out of the system. Ask: if this string were translated into English, would the
program behave wrongly? If yes, it is a functional literal. If no, it is prose, and it is English.

**Boundary.** This is not `COMMENTS-2` reopened by argument: the exception is a PATH plus a MARK, not
a JUDGEMENT. A judgement-based exception is re-argued in every file forever, and the argument is won
by whoever is in a hurry. It is also not `COMMENTS-4`: content files are exempt from the LANGUAGE
rule, but the law does not exempt pictographs in locale data. The rule as written exempts content
files wholesale, so a pictograph in locale data passes the rule while this law forbids it — that
divergence is a recorded gap, not a permission.

**Common business situations.** A `messages/*.json` dictionary · a resources directory · a fixture
reproducing a real payload · a server status code quoted verbatim · the legal name of an organisation
in a contract · a string matched against a third-party system.

## `COMMENTS-4` — no Unicode pictograph in source

**Situation.** Not in identifiers, not in comments, not in diagnostic messages, not in non-content
strings. A pictograph renders differently on every platform, sorts unpredictably, breaks a terminal
that was not expecting it, and does not carry the same meaning in two countries.

**What it emits in source.** Generic interface marks come from the icon vocabulary. A product
reaction uses attributed checked-in SVG artwork, routed through the leaf that owns reactions. That
second path is the narrower case and the only one — it is not an open door.

**Recognition signs.** A pictorial character inside a log string, a message string, or JSX text. A
regional-indicator pair (a flag) — precisely the case a single-pictograph test misses.

**Boundary.** This is not `COMMENTS-3`. Content files are exempt from the LANGUAGE rule only. The law
says a pictograph is NOT exempt, even in locale data; the rule exempts content files wholesale, and
that mismatch between law and rule is a recorded gap.

**Common business situations.** A "done" log line · a status badge · a reaction button · a section
heading · a commit message generated from code · an end-user error message · a CLI string.

## `COMMENTS-5` — a comment that restates its line is deleted, not improved

**Situation.** `// increment the counter` above an increment costs a line and teaches nothing. But it
is worse than harmless: a reader who meets three such comments stops reading the fourth — the one
that says why the counter resets on Sunday.

**What it emits in source.** Nothing. The line is removed. Rewriting a restatement into a better
restatement preserves the whole cost: the reader still has to read it to discover it says nothing.
The cost is in the EXISTENCE, not in the quality of the sentence.

**Recognition signs.** Delete the comment and no information is lost. The comment uses exactly the
words already present in the function and variable names beneath it. The comment describes the
MECHANISM (`calls the API`, `loops over the array`) rather than the CAUSE.

**Boundary.** This is not `COMMENTS-1`: `COMMENTS-1` requires that a block EXIST, `COMMENTS-5`
decides whether the block that exists is KEPT — a documentation block copying the signature is a
restatement and falls here. And it is not `COMMENTS-6`: the moment you want to write at length to
defend the code below, it is no longer a restatement, it is a refusal, and it must be written.

**Common business situations.** Auto-generated comments on getters and setters · `// handle click`
above an `onClick` · `@param` copying the parameter name · banner comments separating sections of an
already well-structured file · a comment calling a `map` "iterates the array".

## `COMMENTS-6` — a comment that argues names the decision it argues with

**Situation.** The comments worth keeping are the ones that record a REFUSAL: what was tried, what it
cost, and why the obvious shape is wrong HERE. Those are exactly the things the next reader will undo
if they are not written down. Not out of carelessness — from their side the code is in a strange
shape with no reason attached, and "tidy it up" is the correct reflex of a good engineer.

**What it emits in source.** A comment at the strange line itself, carrying four things: what the
obvious shape is; why it is wrong HERE, stated as a concrete failure rather than as an adjective;
what was paid to learn that, if anything; and what would make the decision expire.

**Recognition signs.** There is a shorter or clearer way to write this that you deliberately did not
use. There is a workaround, a required execution order, or a constant that looks arbitrary. Somebody
already fixed it the obvious way once and had to come back.

**Boundary.** This is not `COMMENTS-5`: `COMMENTS-5` deletes what says nothing, `COMMENTS-6` COMPELS
writing what only you know. The two do not conflict — they state one sentence together: only prose
that carries information stays. It is also not `COMMENTS-1`: a documentation block states the role
for the CALLER, a `COMMENTS-6` comment states the reason for the person EDITING. A block at the top
of the file cannot replace a comment sitting on the strange line.

**Common business situations.** A workaround for a third-party library defect · a required effect
order · a magic number coming from an external system's limit · a considered `any` · a place
deliberately left un-memoised · a place deliberately called sequentially rather than in parallel · a
query written "sub-optimally" to avoid a lock.

## Layer held

Which tier actually holds each code. `unrepresentable` means a closed union or branded type makes the
wrong value impossible to write; `enforced` means a rule in `@canon-fe` reports it;
`documented` means nothing mechanical holds it and only a reader does.

| Code | Tier | Held by | What the tier does not reach |
|---|---|---|---|
| `COMMENTS-1` | `enforced` | `starci-fe/require-export-jsdoc` | Presence of a block only. Whether the block names the role or restates the signature is unread, and an exported `class`, `enum` or anonymous `export default` is outside the declaration kinds the rule inspects |
| `COMMENTS-2` | `enforced` | `starci-fe/no-second-language-in-source` | Regex literals, which are not string `Literal` nodes and are never visited |
| `COMMENTS-3` | `enforced` | `starci-fe/no-second-language-in-source` (`CONTENT_PATHS`, `isContentFile`, `OK_PRAGMA`) | The mark is read; the REASON after `vn-ok:` is not. `// vn-ok:` with nothing after it passes |
| `COMMENTS-4` | `enforced` | `starci-fe/no-emoji-in-source` | Content files are exempt wholesale, so a pictograph in locale data passes the rule while this law forbids it |
| `COMMENTS-5` | `documented` | — | Nothing. Deciding whether a sentence adds information over the statement below it is paraphrase detection, not parsing |
| `COMMENTS-6` | `documented` | — | Nothing. The shape that was refused is not in the tree; only a reader who knows the alternative can see it is missing |

Three codes are held only in part and two not at all. The lint layer owns presence, path and
character class; it does not own meaning. The layers that must stay ignorant of this concern are the
ones that would otherwise round "partly" up to "enforced": no reviewer, no gate report and no summary
may state that a file is compliant because the rules passed.

## Anchor

Real code each code can be checked against. A law that cannot be pointed at in real code is a
proposal, not a law.

| Code | Anchor | What to look for |
|---|---|---|
| `COMMENTS-1` | `@canon-fe` | Every `export const` in the file opens with a block that names a role — `SECOND_LANGUAGE_LETTER` says which letters and why they matter, not that it is a regex. Compare with `hasBlock` inside `requireExportJsdoc.create`, which is the whole of what the rule actually reads |
| `COMMENTS-2` | `@canon-fe` | The three invalid cases are one sentence in three positions: a comment, a string, a template chunk. That triple is the argument for the rule's reach, written as a test |
| `COMMENTS-3` | `@canon-fe` | `CONTENT_PATHS` and `isContentFile` for the two path exceptions, `OK_PRAGMA` and the `marked` set inside `noSecondLanguageInSource.create` for the third. The valid cases at the `LOCALE` and `FIXTURE` filenames in the twin test show each exception exercised |
| `COMMENTS-4` | `@canon-fe` | `hasEmoji`, and its block explaining why it is two tests rather than one character class. The regional-indicator pair case in the twin test is the one a single pictograph test misses |
| `COMMENTS-5` | `@canon-fe` | The one-line block on `normalizePath`: it says why forward slashes are chosen, not that a replace happens. The restating version of that same block would be legal everywhere and teach nothing |
| `COMMENTS-6` | `@canon-fe` | The block above `const marked` inside `noSecondLanguageInSource.create`: it records what the exemption used to test, why no phrasing could satisfy it, and why the rule's own valid fixture passed for the wrong reason. That is a refusal a reader would otherwise undo |

Every anchor above is lint source inside the trust tree, which is the code this repository can
actually open. No component-tree anchor is verifiable from here; that limit is recorded as a gap
rather than papered over with a path nobody can check.

## Inputs

| Input | Evidence required |
|---|---|
| site | Which prose position this is: block comment, line comment, identifier, string literal, template chunk, JSX text or diagnostic message |
| file | The path, and whether it matches a content path — locale dictionary, fixture, test or spec |
| binding | Whether the declaration is exported, and therefore read by people who never open the body |
| runtime role | Whether a literal is prose a human reads, or a value the program matches on or emits |
| claim | What the comment asserts that the line below does not already state |
| refusal | Which alternative was tried and rejected, and what it cost |

## Rules

1. Every export opens with a documentation block. Internal helpers do not require one.
2. A documentation block names the role. The signature already states the signature, in a form that
   cannot go stale.
3. Every authoring position is English: comment, JSDoc, identifier, literal, template chunk, JSX
   text, diagnostic message.
4. Moving a sentence out of a comment and into a name does not translate it, and does not exempt it.
5. The exceptions are three, closed and named. Locale content, exact fixtures, marked functional
   literals.
6. A functional literal in another language carries its reason on its own line. Unmarked, it is
   indistinguishable from prose somebody forgot to translate.
7. No Unicode pictograph in an authoring position. Generic marks come from the icon vocabulary;
   product reactions use attributed checked-in artwork through the reaction leaf.
8. A comment that restates its line is deleted, not improved.
9. A comment that argues names the decision it argues with.
10. Every prose site resolves to exactly one code. There is no line short enough to be out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Locale content is not authoring** (`COMMENTS-3`). A translation dictionary IS the other language.
  Holding it to `COMMENTS-2` would empty the product.
- **A fixture reproduces a real string exactly** (`COMMENTS-3`). Translated, it is testing something
  else.
- **A functional literal stays, marked** (`COMMENTS-3`). A value the running program matches on or
  emits is not prose. The mark on its own line carries the reason, and the mark is the point: without
  it a reader has to decide, and the next one decides differently.
- **Internal helpers carry no required block** (`COMMENTS-1`). Requiring one on every helper produces
  a file where half the lines are ceremony and no block is read.
- **A re-export has no declaration to document** (`COMMENTS-1`). `export { X }` states a binding, not
  a contract; the contract belongs where `X` was declared.
- **Exceptions are paths, not judgements** (`COMMENTS-3`). A judgement-based exception would be
  argued per file forever, and the argument would be won by whoever was in a hurry.

## Output

One block per prose site the accepted shape produces.

```text
site: <comment | jsdoc | identifier | literal | template | jsx-text | diagnostic>
file: <path> (<authoring | content>)
code: <COMMENTS-1 | COMMENTS-2 | COMMENTS-3 | COMMENTS-4 | COMMENTS-5 | COMMENTS-6>
tier: <enforced: <rule name> | documented>
verdict: <keep | rewrite | delete | mark | move to the icon vocabulary>
reason: <what a reader learns here that the line does not already say>
```

## Worked example

The accepted shape: a status-badge component is exported from an authoring file, it maps a status
string it receives verbatim from a third-party system onto a label, and its locale dictionary holds
the translated label text.

```text
site: jsdoc
file: <authoring file holding the exported component> (authoring)
code: COMMENTS-1
tier: enforced: starci-fe/require-export-jsdoc
verdict: rewrite
reason: the export is read by callers who never open the body, so the block must name the role — this is COMMENTS-1 and not COMMENTS-5 because the fact that decides it is the `export` keyword, not the wording of any sentence
```

```text
site: literal
file: <authoring file holding the exported component> (authoring)
code: COMMENTS-3
tier: enforced: starci-fe/no-second-language-in-source
verdict: mark
reason: the third-party status string is matched with `===`, so translating it would change program behaviour — this is COMMENTS-3 and not COMMENTS-2 because the fact that decides it is the runtime role of the literal, not the language it happens to be in
```

```text
site: literal
file: <locale dictionary path> (content)
code: COMMENTS-3
tier: enforced: starci-fe/no-second-language-in-source
verdict: keep
reason: a translation dictionary IS the other language — this is COMMENTS-3 and not COMMENTS-2 because the fact that decides it is the content path, not a judgement about the string
```

```text
site: jsx-text
file: <authoring file holding the exported component> (authoring)
code: COMMENTS-4
tier: enforced: starci-fe/no-emoji-in-source
verdict: move to the icon vocabulary
reason: a pictograph renders and sorts differently per platform and does not mean the same thing in two countries — this is COMMENTS-4 and not COMMENTS-3 because content files are exempt from the LANGUAGE rule only, and the law exempts no pictograph anywhere
```

What the shape does not state, and therefore does not resolve: whether any comment already in that
file adds information over the line beneath it, and which alternative was refused when this mapping
was written the way it was. `COMMENTS-5` and `COMMENTS-6` cannot be resolved from the accepted shape.
Both are `documented` — no rule reports them, and the refusal that `COMMENTS-6` demands is not in the
tree at all, so only a reader who knows the alternative can see it is missing. Note also that the
mark emitted for the functional literal is checked for presence only: the reason after `vn-ok:` is
never read, and `// vn-ok:` with nothing after it passes.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is ordinary TSX. Where the rule reaches a private
component, the module names the ROLE of that component — the reaction leaf, the icon vocabulary —
never its identifier in one codebase.

AN IDENTIFIER THAT SHIPS IS NOT A PRODUCT NAME IN THIS SENSE. A rule is cited by its published name,
plugin prefix and all, because that is the exact string a build log prints and a disable comment
carries. A citation that cannot be pasted into a search is not a citation. What the ban above forbids
is PROSE and EXAMPLES that need a product to be understood — never an identifier somebody will read
in a failure and have to look up.
