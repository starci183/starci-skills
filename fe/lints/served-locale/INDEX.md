---
id: fe-lints-served-locale-index
title: INDEX.md
slug: /fe/lints/served-locale
sidebar_label: served-locale
sidebar_position: 0
description: What the served-locale rules actually see, and the ways of writing they do not see.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `served-locale`

## Law

Some data is translated on the server, so the request has to declare which language it wants back. A
request that declares nothing is served the default language forever, in every language.

The law is [`patterns/served-locale.md`](../../canon/patterns/served-locale.md) and it carries five
codes, `LOCALE-1` … `LOCALE-5`. This shelf documents only the ENFORCEMENT: two rules published by
[`sources/fe/served-locale.mjs`](../../../sources/fe/served-locale.mjs), what a machine can see of
that law, and — the part nobody writes down — what it cannot.

The source publishes exactly **two** rules. Two of the five law codes have a rule; three do not, and
that is recorded as a finding rather than smoothed over.

## Rules

| Rule | Enforces | What it reports |
|---|---|---|
| `api-client-attaches-the-locale` | `LOCALE-1` | A file that constructs the terminal HTTP link but contains no call to a locale-link factory. Reported once per file, on the first terminal-link node. |
| `locale-header-belongs-to-the-link` | `LOCALE-5` | An object property keyed `x-locale` in any file that is not the locale link. Reported once per offending property. |

`LOCALE-2` (read the locale from the address, not from an argument), `LOCALE-3` (a cookie is not
transport across an origin) and `LOCALE-4` (the server default is a floor, not a fallback) have **no
rule at all**. Each is a claim about what a value IS, and both rules only ever see a name. The source
says this in its own header rather than implying it, and this shelf repeats it: those three codes are
review questions, and treating a green build as evidence about them is the mistake this module
exists to prevent.

## Detection

| Rule | Mechanism |
|---|---|
| `api-client-attaches-the-locale` | Two exemption gates on `context.filename` (falling back to `context.getFilename()`), with backslashes normalised to forward slashes first: `/\/links\/[^/]+$/` (a file directly inside a folder named `links`) and `/\.(?:test\|spec)\.[cm]?[jt]sx?$/`. Then one visitor bound to both `CallExpression` and `NewExpression`. It resolves a callee name — `Identifier` gives `.name`, a `MemberExpression` with an `Identifier` property gives `.property.name`, anything else gives `null` — and compares that string against two hard-coded sets: terminal `createHttpLink`, `HttpLink`, `createUploadLink`, `BatchHttpLink`; locale `createAttachLocaleLink`, `createLocaleLink`. At `Program:exit`, a terminal name seen with no locale name seen reports. |
| `locale-header-belongs-to-the-link` | One exemption gate on the normalised `context.filename`: `/\/links\/locale\.[cm]?tsx?$/`. Then a `Property` visitor. The key is read as a string in two ways only — a non-computed `Identifier` key gives `.name`, a `Literal` key with a string value gives `.value` whether computed or not — and is compared for exact equality with the literal `"x-locale"`. |

Neither rule reads types, resolves an import, follows a variable, or looks at any file but the one in
front of it. Both are `type: "problem"` with `schema: []`, so there is no option to soften either,
and neither offers a fix.

## Escape Hatches

### Closed

| A reader might expect this to slip past | Why it does not |
|---|---|
| `new HttpLink({ uri })` instead of `createHttpLink({ uri })` | One visitor function is bound to both `CallExpression` and `NewExpression`, so a constructor and a factory are read the same way. |
| `transport.createHttpLink({ uri })` — reached through an object | `calleeName` unwraps a `MemberExpression` and returns `.property.name`, so the qualifier is discarded. |
| Attaching the locale link lower in the file than the terminal link | The comparison happens at `Program:exit`, after the whole file is walked, so source order is irrelevant. |
| `{ ["x-locale"]: locale }` — a computed key rather than a plain one | `propertyKeyOf` accepts any `Literal` key with a string value, computed or not. |
| A Windows path, where the separator is a backslash | Every path test runs on a normalised copy, so `\` and `/` compare identically. |
| Renaming a chain file, or giving it a `.tsx` extension | The chain rule is not filename-gated at all except by its two exemptions. Any file anywhere is inspected. |
| Burying the terminal link one folder deeper, at `links/http/index.ts`, to inherit the link exemption | `/\/links\/[^/]+$/` requires the file to sit **directly** in `links`, so a nested path does not qualify. |
| Writing the header in a hook rather than in the transport | The header rule inspects every file except the one exempt path, so a hook, a query function or a config object all report. |

### Open

Every row below is a way of writing that the rule genuinely does NOT catch. None of them is
sabotage; most are somebody tidying up.

| Rule | What slips through | Why the mechanism cannot see it |
|---|---|---|
| `api-client-attaches-the-locale` | The terminal factory imported under another name: `import { createHttpLink as createTransport }`, then `createTransport({ uri })`. | The set holds four strings and is compared against the callee's spelling. An import alias changes the spelling, and the rule does not resolve imports. |
| `api-client-attaches-the-locale` | A chain assembled from links built elsewhere: `from([localeLink, authLink, httpLink])`, where each is an imported const. | No call and no `new` appears, so no terminal name is ever seen and the file is silent — including when the locale link is the one that was left out. |
| `api-client-attaches-the-locale` | `createLocaleLink` present in the file but not in the chain: assigned to an unused const, sitting in a dead branch, or defined locally as a stub. | The rule records that a NAME was called somewhere in the file. It never checks that the result reaches the array the terminal link is in, or that it precedes it. |
| `api-client-attaches-the-locale` | Conditional attachment: `...(isLoggedIn ? [createAttachLocaleLink()] : [])`. | `LOCALE-1` says unconditional in so many words — a guest reads in a language too — and the rule has no view of the conditional. The call happened; that is all it knows. |
| `api-client-attaches-the-locale` | A whole chain that happens to live in a file directly inside a folder named `links`. | The exemption is a FOLDER ban, not a file ban. It was added for a real reason and it exempts every sibling in that folder along with the intended one. |
| `api-client-attaches-the-locale` | A locale link that computes the wrong value — a hard-coded language, or a value read from an argument nobody passes. | The rule sees a name, never a body. `LOCALE-2`, `LOCALE-3` and `LOCALE-4` are all downstream of a value it cannot look at. |
| `locale-header-belongs-to-the-link` | `headers["x-locale"] = locale` | An assignment to a member expression is not a `Property` node. The rule only walks object literals. |
| `locale-header-belongs-to-the-link` | `headers.set("x-locale", locale)` | Here the header name is an ARGUMENT, not a key. Nothing in the rule reads call arguments. |
| `locale-header-belongs-to-the-link` | `const HEADER = "x-locale"` … `{ [HEADER]: locale }` | A computed `Identifier` key returns `null` from `propertyKeyOf`, because that branch requires the key to be non-computed. The constant launders the literal — and the source file itself exports exactly such a constant. |
| `locale-header-belongs-to-the-link` | `{ "X-Locale": locale }`, or any other casing. | The comparison is exact string equality. Header names are case-insensitive on the wire, so this sets the same header and reports nothing. |
| `locale-header-belongs-to-the-link` | `{ ...localeHeader }`, where the object was built in another module. | A spread element is not a `Property`, and the object it spreads is in a file the rule is not looking at. |
| `locale-header-belongs-to-the-link` | The exempt file renamed to `links/attach-locale.ts` — or written in JavaScript as `links/locale.js`. | The exemption is a filename pattern, and its extension group is `[cm]?tsx?`: it matches `.ts`, `.tsx`, `.mts`, `.cts` and nothing else. Filename is the cheapest thing in a repository to change. |
| `locale-header-belongs-to-the-link` | Any unrelated file that happens to sit at some path ending `/links/locale.ts`. | The gate is a suffix match on the path, not an identity check on the module, so a second file with that name anywhere in the tree may write the header freely. |
| `locale-header-belongs-to-the-link` | The locale link that stops writing the header entirely. | The rule bans the string elsewhere; it never asserts the string is present in the one place it belongs. Both rules stay green while nothing sends the header — the exact failure the law was written after. |

## Inputs

| Input | What is available |
|---|---|
| filename | `context.filename`, or `context.getFilename()` where the first is absent. Compared as a normalised forward-slash path. |
| syntax | The AST of ONE file: `CallExpression`, `NewExpression`, `Property`. |
| names | The callee's own spelling, and the property key's spelling. |
| types | None. |
| imports | Not resolved. An imported binding is a name and nothing more. |
| other files | Not read. Both rules are file-at-a-time by construction. |

## Invariants

- Both rules are `type: "problem"` and ship at `error`. There is no warn tier and no option object.
- `api-client-attaches-the-locale` reports at most once per file, anchored to the FIRST terminal-link
  node seen.
- `locale-header-belongs-to-the-link` reports once per offending property, so several in one file all
  report.
- Neither rule provides a fix. A report is always a human edit.
- A green result on both rules is a statement about NAMES and PLACES, never about the value a request
  carries.

## Exceptions

Three exemptions exist in the source, and each one belongs to exactly one rule.

- **A single link's implementation** is exempt from the chain rule. A file directly inside `links/`
  defines one link; constructing the terminal link is that file's whole job, and attaching a locale
  link inside it would be a chain hiding in a link. This exemption was found by running the rule, not
  by thinking about it: without it the rule reported a file that had done everything right, and a
  rule with no correct way to be satisfied is a finding about the rule.
- **A spec or test file** is exempt from the chain rule. It asserts about a chain rather than being
  one.
- **The locale link file** is exempt from the header rule, recognised by path rather than by content,
  because the point of that rule is that one named place owns the header.

The header rule has **no** test exemption. The helper that recognises a spec file exists and is used
by the chain rule only, so an assertion that names the header reports like production code.

## Output

A report prints the rule's published name, prefixed by the plugin namespace:

```text
<path>
  <line>:<col>  error  <message>  starci-fe/api-client-attaches-the-locale
  <line>:<col>  error  <message>  starci-fe/locale-header-belongs-to-the-link
```

The published name IS the identity of the rule. It is what appears in a build log, in a disable
comment and in every conversation about the failure, so this shelf gives it no second numeric code.

## Load Policy

Read this file for what the rules see. Read `vi.md` for why each is worth a machine, `example.md`
for the code that fires and the code that slips through, `audit.md` while reviewing whether the
enforcement still matches the law, and `changelog.md` for the version history.

## Scope

This module documents two rules and nothing else. It names no product, no client library and no
repository; the rule names, the callee names those rules watch and the header string are identifiers
that ship, and they are quoted verbatim because a renamed identifier is a different rule.

## Version Rule

Increment all five records by `0.01` for an accepted change and record it in `changelog.md`. A new
rule, a changed detection mechanism or a newly discovered open hatch is such a change.
