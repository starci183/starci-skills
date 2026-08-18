# Served-locale

## LOADS

None.

## Record

The input is code that is already written — one file, one hunk of a diff. The output is a **verdict**:
whether the file was in scope at all, which published rule fired, what it reported and on which node,
which law code that maps to, and the open hatch that would have hidden the same failure. This module
chooses nothing. It refuses, and it must be able to point at the node it refuses on.

## Law

Some data is translated on the server, so the request has to declare which language it wants back. A
request that declares nothing is served the default language forever, in every language.

The law carries five codes, `LOCALE-1` … `LOCALE-5`. The source publishes exactly **two** rules. Two
of the five law codes have a rule; three do not, and that is recorded as a finding rather than smoothed
over. This module documents only the ENFORCEMENT: what a machine can see of that law, and — the part
nobody writes down — what it cannot.

## Published rules

| Rule | Code | What it reports |
|---|---|---|
| `api-client-attaches-the-locale` | `LOCALE-1` | A file that constructs the terminal HTTP link but contains no call to a locale-link factory. Reported once per file, on the first terminal-link node. |
| `locale-header-belongs-to-the-link` | `LOCALE-5` | An object property keyed `x-locale` in any file that is not the locale link. Reported once per offending property. |

`LOCALE-2` (read the locale from the address, not from an argument), `LOCALE-3` (a cookie is not
transport across an origin) and `LOCALE-4` (the server default is a floor, not a fallback) have **no
rule at all**. Each is a claim about what a value IS, and both rules only ever see a name. They are
unenforced rather than covered: those three codes are review questions, and treating a green build as
evidence about them is the mistake this module exists to prevent.

## Reading a diff

1. **Decide scope before anything else, and record it.** Out of scope here does not mean the file
   passed — it means the exemption gate fired and the rule did not judge that file at all.
2. **Check the exemptions.** `api-client-attaches-the-locale` is off for a file sitting directly inside
   a folder named `links`, and off for a `.test.` or `.spec.` file.
   `locale-header-belongs-to-the-link` is off only for the locale link file itself, and it has no test
   exemption.
3. **Read the nodes.** For the chain rule, every `CallExpression` and `NewExpression` callee name in
   the file, decided at `Program:exit`. For the header rule, every `Property` key readable as a string.
4. **Emit one block per finding.** The chain rule gives at most one block per file; the header rule
   gives one per offending property.
5. **Write the `hatch` line** whenever an open hatch would have hidden the same failure.
6. **Do not report what no rule watches.** Three of the five codes have no machine; a verdict that
   claims otherwise is wrong about the module.

## `api-client-attaches-the-locale` — LOCALE-1

**What it reports.** A file that constructs the terminal HTTP link but contains no call to a
locale-link factory. One report per file, anchored to the FIRST terminal-link node seen.

**How it detects.** Two exemption gates on `context.filename` (falling back to
`context.getFilename()`), with backslashes normalised to forward slashes first: `/\/links\/[^/]+$/` (a
file directly inside a folder named `links`) and `/\.(?:test|spec)\.[cm]?[jt]sx?$/`. Then one visitor
bound to both `CallExpression` and `NewExpression`. It resolves a callee name — `Identifier` gives
`.name`, a `MemberExpression` with an `Identifier` property gives `.property.name`, anything else gives
`null` — and compares that string against two hard-coded sets: terminal `createHttpLink`, `HttpLink`,
`createUploadLink`, `BatchHttpLink`; locale `createAttachLocaleLink`, `createLocaleLink`. At
`Program:exit`, a terminal name seen with no locale name seen reports.

**What it cannot see.** The terminal factory imported under another name —
`import { createHttpLink as createTransport }`, then `createTransport({ uri })` — because the set holds
four strings compared against the callee's spelling and the rule does not resolve imports. A chain
assembled from links built elsewhere, `from([localeLink, authLink, httpLink])`, where no call and no
`new` appears, so no terminal name is ever seen and the file is silent — including when the locale link
is the one that was left out. `createLocaleLink` present in the file but not in the chain: assigned to
an unused const, sitting in a dead branch, or defined locally as a stub; the rule records that a NAME
was called somewhere in the file, never that the result reaches the array the terminal link is in or
that it precedes it. Conditional attachment, `...(isLoggedIn ? [createAttachLocaleLink()] : [])`, while
`LOCALE-1` says unconditional in so many words — a guest reads in a language too. A whole chain that
happens to live in a file directly inside a folder named `links`, because the exemption is a FOLDER ban
and exempts every sibling along with the intended one. And a locale link that computes the wrong value
— a hard-coded language, or a value read from an argument nobody passes — because the rule sees a name,
never a body.

**Boundary.** This rule judges whether a name was called in one file. Where the header string may be
written is `locale-header-belongs-to-the-link`. `LOCALE-2`, `LOCALE-3` and `LOCALE-4` are all
downstream of a value neither rule can look at.

## `locale-header-belongs-to-the-link` — LOCALE-5

**What it reports.** An object property keyed exactly `x-locale`, in any file that is not the locale
link. One report per offending property, so several in one file all report.

**How it detects.** One exemption gate on the normalised `context.filename`:
`/\/links\/locale\.[cm]?tsx?$/`. Then a `Property` visitor. The key is read as a string in two ways
only — a non-computed `Identifier` key gives `.name`, a `Literal` key with a string value gives
`.value` whether computed or not — and is compared for exact equality with the literal `"x-locale"`.

**What it cannot see.** `headers["x-locale"] = locale`, because an assignment to a member expression is
not a `Property` node and the rule only walks object literals. `headers.set("x-locale", locale)`, where
the header name is an ARGUMENT and nothing in the rule reads call arguments. `const HEADER =
"x-locale"` … `{ [HEADER]: locale }`, because a computed `Identifier` key returns `null` from
`propertyKeyOf` — that branch requires the key to be non-computed — so the constant launders the
literal, and the source file itself exports exactly such a constant. `{ "X-Locale": locale }`, or any
other casing, because the comparison is exact string equality while header names are case-insensitive
on the wire. `{ ...localeHeader }`, where a spread element is not a `Property` and the object it spreads
is in a file the rule is not looking at. The exempt file renamed to `links/attach-locale.ts` — or
written in JavaScript as `links/locale.js` — because the exemption is a filename pattern whose
extension group `[cm]?tsx?` matches `.ts`, `.tsx`, `.mts`, `.cts` and nothing else, and a filename is
the cheapest thing in a repository to change. Any unrelated file that happens to sit at some path
ending `/links/locale.ts`, because the gate is a suffix match on the path, not an identity check on the
module. And the locale link that stops writing the header entirely: the rule bans the string elsewhere
and never asserts the string is present in the one place it belongs, so both rules stay green while
nothing sends the header — the exact failure the law was written after.

**Boundary.** This rule judges where a string may be written. Whether a locale link was attached to the
chain at all is `api-client-attaches-the-locale`.

## Detection

| Part | Mechanism |
|---|---|
| the path gate | `context.filename`, or `context.getFilename()` where the first is absent, with backslashes normalised to forward slashes before every test, so `\` and `/` compare identically |
| chain-rule exemptions | `/\/links\/[^/]+$/` and `/\.(?:test\|spec)\.[cm]?[jt]sx?$/` |
| header-rule exemption | `/\/links\/locale\.[cm]?tsx?$/` |
| the walker | One visitor bound to both `CallExpression` and `NewExpression` for the chain rule; one `Property` visitor for the header rule |
| the reader | `calleeName`: `Identifier` gives `.name`, a `MemberExpression` with an `Identifier` property gives `.property.name`, anything else gives `null`. `propertyKeyOf`: a non-computed `Identifier` key gives `.name`, a `Literal` key with a string value gives `.value`, computed or not |
| the sets | terminal `createHttpLink`, `HttpLink`, `createUploadLink`, `BatchHttpLink`; locale `createAttachLocaleLink`, `createLocaleLink`; header string `"x-locale"` |
| reaching outside the file | Nothing does. Neither rule reads types, resolves an import, follows a variable, or looks at any file but the one in front of it |

Both rules are `type: "problem"` with `schema: []`, so there is no option to soften either, and neither
offers a fix.

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
|---|---|
| `new HttpLink({ uri })` instead of `createHttpLink({ uri })` | One visitor function is bound to both `CallExpression` and `NewExpression`, so a constructor and a factory are read the same way |
| `transport.createHttpLink({ uri })` — reached through an object | `calleeName` unwraps a `MemberExpression` and returns `.property.name`, so the qualifier is discarded |
| Attaching the locale link lower in the file than the terminal link | The comparison happens at `Program:exit`, after the whole file is walked, so source order is irrelevant |
| `{ ["x-locale"]: locale }` — a computed key rather than a plain one | `propertyKeyOf` accepts any `Literal` key with a string value, computed or not |
| A Windows path, where the separator is a backslash | Every path test runs on a normalised copy |
| Renaming a chain file, or giving it a `.tsx` extension | The chain rule is not filename-gated at all except by its two exemptions. Any file anywhere is inspected |
| Burying the terminal link one folder deeper, at `links/http/index.ts`, to inherit the link exemption | `/\/links\/[^/]+$/` requires the file to sit **directly** in `links`, so a nested path does not qualify |
| Writing the header in a hook rather than in the transport | The header rule inspects every file except the one exempt path, so a hook, a query function or a config object all report |

**Open** — shipped blindness. A verdict must not claim these were judged. None of them is sabotage;
most are somebody tidying up.

| Scope | What passes | What it costs |
|---|---|---|
| `api-client-attaches-the-locale` | The terminal factory imported under another name | The chain is never recognised as a chain |
| `api-client-attaches-the-locale` | A chain assembled from links built elsewhere, with no call and no `new` | Silent even when the locale link is the one left out |
| `api-client-attaches-the-locale` | `createLocaleLink` called but not in the chain — unused const, dead branch, local stub | A name proves nothing about the array or the order |
| `api-client-attaches-the-locale` | Conditional attachment | `LOCALE-1` says unconditional; a guest reads in a language too |
| `api-client-attaches-the-locale` | A whole chain living directly inside a folder named `links` | A folder ban exempts every sibling |
| `api-client-attaches-the-locale` | A locale link that computes the wrong value | The rule sees a name, never a body |
| `locale-header-belongs-to-the-link` | `headers["x-locale"] = locale` | An assignment is not a `Property` |
| `locale-header-belongs-to-the-link` | `headers.set("x-locale", locale)` | The header name is an argument, and arguments are unread |
| `locale-header-belongs-to-the-link` | `const HEADER = "x-locale"` … `{ [HEADER]: locale }` | The constant launders the literal — the source file exports exactly such a constant |
| `locale-header-belongs-to-the-link` | `{ "X-Locale": locale }`, or any other casing | The same header goes on the wire and nothing reports |
| `locale-header-belongs-to-the-link` | `{ ...localeHeader }` built in another module | A spread is not a `Property`, and that module is not opened |
| `locale-header-belongs-to-the-link` | The exempt file renamed to `links/attach-locale.ts`, or written as `links/locale.js` | The exemption is a filename, the cheapest thing to change |
| `locale-header-belongs-to-the-link` | Any unrelated file at a path ending `/links/locale.ts` | A suffix match is not an identity check; that file may write the header freely |
| `locale-header-belongs-to-the-link` | The locale link that stops writing the header entirely | Both rules stay green while nothing sends the header — the exact failure the law was written after |
| neither | **Everything `LOCALE-2`, `LOCALE-3` and `LOCALE-4` forbid** — the locale read from an argument instead of the address, a cookie used as transport across an origin, the server default treated as a fallback | Three of five codes have no machine at all |

A green result on both rules is a statement about NAMES and PLACES, never about the value a request
carries.

## Rules

1. The identity of a rule is its **published name**. This module gives no rule a second numeric code.
2. Both rules are `type: "problem"` and ship at `error`. There is no warn tier and no option object.
3. `api-client-attaches-the-locale` reports at most once per file, anchored to the FIRST terminal-link
   node seen.
4. `locale-header-belongs-to-the-link` reports once per offending property, so several in one file all
   report.
5. Neither rule provides a fix. A report is always a human edit.
6. A green result on both rules is a statement about NAMES and PLACES, never about the value a request
   carries.
7. Only rules that exist in the source are documented as rules. A rule that ought to exist is a risk,
   not a rule.
8. Every rule carries at least one written open hatch, or an argument for why it is closed. Writing
   "none" for brevity is forbidden: an unknown open hatch is more dangerous than a law with no rule,
   because everyone knows an unenforced law is unheld while a leaking rule is believed sealed.

## Exceptions

Three exemptions exist in the source, and each one belongs to exactly one rule.

- **A single link's implementation** is exempt from the chain rule, which releases `LOCALE-1` for a file
  directly inside `links/`. Such a file defines one link; constructing the terminal link is that file's
  whole job, and attaching a locale link inside it would be a chain hiding in a link. This exemption
  was found by running the rule, not by thinking about it: without it the rule reported a file that had
  done everything right, and a rule with no correct way to be satisfied is a finding about the rule.
- **A spec or test file** is exempt from the chain rule, which releases `LOCALE-1` there. It asserts
  about a chain rather than being one.
- **The locale link file** is exempt from the header rule, which releases `LOCALE-5` for that one path,
  recognised by path rather than by content, because the point of that rule is that one named place owns
  the header.

The header rule has **no** test exemption. The helper that recognises a spec file exists and is used by
the chain rule only, so an assertion that names the header reports like production code.

## Output

One block per finding:

```text
file: <path as the rule sees it, forward slashes>
rule: <api-client-attaches-the-locale | locale-header-belongs-to-the-link>
scope: <in | out — the exemption gate that decided it>
report: <line>:<col>  error  <message>  starci-fe/<rule>
code: <LOCALE-1 | LOCALE-5>
hatch: <the open hatch that would have hidden this, or none>
```

The published name IS the identity of the rule. It is what appears in a build log, in a disable comment
and in every conversation about the failure.

A clean file emits one block with `report: none` and the `hatch` line naming whatever open hatch would
have hidden a failure here, or `none`. An out-of-scope file emits one block with `scope: out` and the
gate that exempted it, and `report: unjudged` — never `report: none`, because the rule did not look.
