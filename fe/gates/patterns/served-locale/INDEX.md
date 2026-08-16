---
id: fe-patterns-served-locale-index
title: INDEX.md
slug: /gates/patterns/served-locale
sidebar_label: served-locale
sidebar_position: 0
description: Binding rules for how a request declares the language it wants served, where that declaration is derived, and which single place writes it.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `served-locale`

## Law

Some data is translated on the server. A document, a content body, a category name — the API stores
one row per locale and hands back the one it was asked for. Which means the request has to ask, and a
request that says nothing gets the server's default, forever, in every language.

The declaration belongs to the transport, not to the caller. **The chain that reaches the network
attaches the locale, and exactly one file writes it.** A screen can be perfectly translated — every
label resolved above the drawing half, no literal below a block — and still show a reader an English
document, because the chrome came from the dictionary and the content came from an API that was never
told which language to serve.

The question that settles whether something belongs here: **would a reader in another language get
different DATA back from this call?** If yes, the request must declare the locale, and it must
declare it in one place rather than at each call site.

**This is binding, not advisory.** This law is not the same as the neighbouring translation law. That
one settles **who chooses the word** inside the component tree; this one settles **what the request
declares** on its way out. Obeying one says nothing about the other, and the failure mode of missing
this one is that it reads like a failure of that one — a bilingual chrome over monolingual content
gets looked for in the dictionary, where nothing is wrong.

## Situation Codes

Every situation this module governs carries a code, `LOCALE-<n>`. The code names the SITUATION.

| Code | What it requires | What it forbids |
|---|---|---|
| `LOCALE-1` | Every transport chain that builds the terminal link also attaches the reader's locale, unconditionally, beside the auth link | A chain that reaches the network mute about language, and any condition — auth, feature flag, route — placed on the attachment |
| `LOCALE-2` | The link derives the locale from the address the reader is already on | A `locale` argument threaded through hooks, query functions or call sites, because it is a parameter the next author omits |
| `LOCALE-3` | The value travels as a request header when the API is another origin | Relying on a cookie the server can read in principle and never receives in practice |
| `LOCALE-4` | Every request declares a locale, so the server's default is a floor beneath a declaration rather than the thing that answered | Reading a correct-looking default answer as proof that the fallback works |
| `LOCALE-5` | The header literal is written by the locale link, and by nothing else | A second call site setting the same header by hand |

`LOCALE-3` AND `LOCALE-4` ARE NOT COMMENTARY ON THE OTHER THREE. They name the two ways a surface
passes review while still being monolingual: a carrier that cannot cross the boundary it is asked to
cross, and an answer that looks right because the reader who would notice is not the one testing.
Both are silent, and a silent failure with no name is a failure nobody can be shown to have caused.

The numbering has no gaps and gains none. These five codes are cited from other law files and from
task records; a code renumbered here silently breaks a citation somebody already made.

## Tầng giữ

Which tier actually holds each code — a closed type, a lint rule, or only a reader.

| Code | Tier | Held by |
|---|---|---|
| `LOCALE-1` | `enforced` | `starci-fe/api-client-attaches-the-locale` |
| `LOCALE-2` | `documented` | nothing mechanical |
| `LOCALE-3` | `documented` | nothing mechanical |
| `LOCALE-4` | `documented` | nothing mechanical |
| `LOCALE-5` | `enforced` | `starci-fe/locale-header-belongs-to-the-link` |

Three of five rows read `documented`, and the table exists to say so out loud rather than to let the
two enforced rows imply the module is covered.

The gap has one shape, and the rule source states it rather than implying it: both rules are
**file-at-a-time** facts. A chain is assembled in one file, and a header is written where it is
written. Neither rule can see whether the value the link computes is CORRECT — whether it reads the
address, reads a cookie, or returns a constant — because that lives inside a function the rules only
know the NAME of. A link named `createAttachLocaleLink` that attaches `"en"` unconditionally
satisfies both rules and is wrong in exactly the way this law exists to prevent. That case is
`LOCALE-2`, and it is a review question by construction, not by omission.

`LOCALE-3` and `LOCALE-4` are further out of reach: one is a fact about the DEPLOYMENT (whether the
API is another origin), the other is a fact about an ANSWER the gate never sees. Neither is visible
in a source file at all.

## Anchor

A law that cannot be pointed at in real code is a proposal. Paths are repository-relative source
paths; the shape of the tree, not the name of any product, is what makes them checkable.

| Code | Anchor | What to look for |
|---|---|---|
| `LOCALE-1` | `src/modules/api/graphql/clients/create-apollo-client.ts` | The locale link is a plain element of the chain array — before the terminal link, outside the conditional spread that inserts the auth link. Adding auth adds exactly one link; the locale link is in both shapes |
| `LOCALE-2` | `src/modules/api/graphql/clients/links/locale.ts` | The resolver takes no locale argument. It reads the first path segment, and it rejects a segment that is not a shipped locale rather than accepting whatever the default narrowing returns. Public callers pass nothing |
| `LOCALE-3` | `src/modules/api/graphql/clients/links/http.ts` | `credentials` is `"include"` only when the caller opts in, and it defaults to off — so the anonymous request, which is nearly every read, sends no cookie. The header is the only carrier that survives that path |
| `LOCALE-4` | `src/modules/api/graphql/clients/links/locale.ts`, the resolver's return type and its no-address branch | The return type is the closed locale union, not an optional. There is no path that returns nothing, so there is no path that hands the server an undeclared request to be careful about |
| `LOCALE-5` | one search of the tree for the header literal | It appears in exactly one production file — the locale link — and its other occurrences are that file's own prose. A second production hit is the violation itself |

`LOCALE-4`'s anchor is the weakest of the five and is recorded as such in `audit.md`: it proves the
client always declares SOMETHING, not that what it declared came from the reader.

## Inputs

| Input | Evidence required |
|---|---|
| call | The operation, and the transport chain it travels through |
| answer | Whether the response body differs per reader, or only the chrome around it does |
| origin | Whether the API is the same origin as the app |
| carrier | Where the value would ride: transport header, cookie, argument, or nothing |
| source | Where the value is derived: address, remembered choice, or app default |
| ownership | Which file writes the header |

## Invariants

- A chain that reaches the network declares a language.
- The declaration is unconditional; a guest reads in a language too.
- The locale is DERIVED where the request is assembled, never PASSED to it.
- The address is the strongest available statement of intent, and the only one nobody has to
  remember to forward.
- A cookie is not a carrier across an origin boundary the request does not opt into.
- The server's default sits beneath a declaration; it is never the thing that decided.
- Exactly one file writes the header.
- Every call whose answer differs per reader resolves to exactly one code. No call is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **One link's own implementation (`LOCALE-1`).** A file that IS a link is not a chain. The file
  defining the terminal link constructs it because that is its whole job, and there is no correct way
  to attach a locale there — a locale link inside the terminal link is a chain hiding in a link. The
  exemption is a PATH, and it was found by running the rule, not by predicting it.
- **Specs (`LOCALE-1`).** A spec asserts about a chain rather than being one.
- **The locale link itself (`LOCALE-5`).** The one file allowed to write the header is recognised by
  path, because the point of the code is that the place is NAMED and can be cited.
- **A test seam (`LOCALE-2`).** A link may accept an injected resolver so a spec can fix the value.
  That is not a threaded parameter: production callers pass nothing, and the default is the derived
  one. The moment a production call site starts passing it, the seam has become the argument
  `LOCALE-2` forbids.
- **A render with no address (`LOCALE-2`, `LOCALE-4`).** Where there is no address to read — a
  server-side render — the resolver returns the app default rather than omitting the header, and the
  client corrects it on re-fetch. The exemption is closed to that one branch. Its cost is real and is
  argued in `audit.md`.

## Output

```text
call: <the operation, and the chain it travels through>
code: <LOCALE-1 | LOCALE-2 | LOCALE-3 | LOCALE-4 | LOCALE-5>
carrier: <transport header | cookie | argument | nothing>
source: <address | remembered choice | app default>
declared: <yes | no>
reason: <the fact that excludes the adjacent code>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module states a rule true of any front end whose API serves translated data. It names no
product, no component library and no repository. Every example is ordinary TSX.

AN IDENTIFIER THAT SHIPS IS NOT A PRODUCT NAME IN THIS SENSE. A rule is cited by its published
name, plugin prefix and all, because that is the exact string a build log prints and a disable
comment carries. A citation that cannot be pasted into a search is not a citation. What the ban
above forbids is PROSE and EXAMPLES that need a product to be understood - never an identifier
somebody will read in a failure and have to look up.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
