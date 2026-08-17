---
title: Served-locale
module: served-locale
kind: pattern
codes: [LOCALE-1, LOCALE-2, LOCALE-3, LOCALE-4, LOCALE-5]
---

# Served-locale

The input to this pattern is a shape somebody already accepted: a screen, a capability, a data
contract whose answer is translated on the server. The decision that the surface must read in the
reader's language is not re-opened here. What this pattern produces is source architecture — which
file assembles the transport chain, which file derives the locale, which file is permitted to write
the header literal, and what each of them may accept as an argument. The shape says the reader gets
their own language; this pattern says where in the tree that becomes true.

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

## Situation codes

Every situation this module governs carries a code, `LOCALE-<n>`. The code names the SITUATION.

| Code | Situation | What the source must look like |
|---|---|---|
| `LOCALE-1` | A transport chain is assembled and reaches the network without carrying a language | Every transport chain that builds the terminal link also attaches the reader's locale, unconditionally, beside the auth link. Forbidden: a chain that reaches the network mute about language, and any condition — auth, feature flag, route — placed on the attachment |
| `LOCALE-2` | The locale value has to come from somewhere, and somebody proposes threading it down | The link derives the locale from the address the reader is already on. Forbidden: a `locale` argument threaded through hooks, query functions or call sites, because it is a parameter the next author omits |
| `LOCALE-3` | The app remembers the choice in a cookie and the API lives on another origin | The value travels as a request header when the API is another origin. Forbidden: relying on a cookie the server can read in principle and never receives in practice |
| `LOCALE-4` | The server answered in its default language and the answer looked correct | Every request declares a locale, so the server's default is a floor beneath a declaration rather than the thing that answered. Forbidden: reading a correct-looking default answer as proof that the fallback works |
| `LOCALE-5` | A second place in the tree writes the same language header by hand | The header literal is written by the locale link, and by nothing else. Forbidden: a second call site setting the same header by hand |

`LOCALE-3` AND `LOCALE-4` ARE NOT COMMENTARY ON THE OTHER THREE. They name the two ways a surface
passes review while still being monolingual: a carrier that cannot cross the boundary it is asked to
cross, and an answer that looks right because the reader who would notice is not the one testing.
Both are silent, and a silent failure with no name is a failure nobody can be shown to have caused.

The numbering has no gaps and gains none. These five codes are cited from other law files and from
task records; a code renumbered here silently breaks a citation somebody already made.

## Reading an accepted shape

1. **Read what the shape states.** It states that a reader in another language sees this surface in
   their language, and it states which data the surface shows.
2. **Read what it does not state, and therefore does not resolve.** An accepted shape does not name a
   client file, does not say whether the API is the same origin as the app, does not choose a
   carrier, and does not say where the value is derived. Those four facts are what this pattern
   resolves; the shape supplies none of them.
3. **Resolve outermost first.** Start at the chain that builds the terminal link (`LOCALE-1`), then
   the link that derives the value (`LOCALE-2`), then the carrier that has to cross the boundary
   (`LOCALE-3`), then the answer that comes back (`LOCALE-4`), then the count of writers in the tree
   (`LOCALE-5`).
4. **Ask each code's question.** `LOCALE-1`: does the chain that reaches the network attach a
   language, and does it attach it unconditionally? `LOCALE-2`: does the value arrive by being
   derived, or by being passed? `LOCALE-3`: on the exact path this request travels — anonymous,
   cross-origin — is the cookie actually sent? `LOCALE-4`: is this answer right because the request
   made it explicit, or because the tester happens to read the default language? `LOCALE-5`: if the
   locale source changes tomorrow, how many places must be edited to be correct again?
5. **When two codes both match, record both.** A call site that sets the header by hand *and* takes
   `locale` as a parameter violates `LOCALE-5` and `LOCALE-2`; write both codes, do not pick one.
   Where the codes stand in a cause-and-consequence relation — `LOCALE-1` or `LOCALE-3` as the cause,
   `LOCALE-4` as the way the consequence is waved through — record the cause and record `LOCALE-4`
   separately if somebody is treating the default answer as proof.

## `LOCALE-1` — every chain declares, and declares unconditionally

**Situation.** There is one place in the app that assembles the transport: retry, timeout, auth, then
the terminal link that actually touches the network. The locale must travel **there**, not inside the
hook that happens to need it.

**What it emits in source.** A locale link that is a plain element of the chain array, before the
terminal link and outside the conditional spread that inserts the auth link. Adding auth adds exactly
one link; the locale link is present in both shapes. The file that assembles the chain owns this; the
hook owns nothing about it.

**Recognition signs.**

- The file is building the terminal link — the one link that talks to the network.
- The chain is otherwise complete: retry, timeout, token — and mute about language.
- The attachment sits behind a condition: only when signed in, only on one route, only behind a flag.

Ask: if I attach the locale at the hook layer instead of at the chain, will the next author of a new
hook **have to remember** to attach it? If yes, it is in the wrong place. And it is unconditional
because a guest reads in a language too — unlike a bearer token, there is no anonymous branch that is
**allowed** to declare nothing. Putting the locale behind a `withAuth` flag turns all public content —
what most readers see first — into the default language.

**Boundary.** This is not `LOCALE-5`: `LOCALE-1` says there must **be** a place that attaches;
`LOCALE-5` says there must be **only one**. A missing chain is `LOCALE-1`; two writers is `LOCALE-5`.
It is not `LOCALE-2` either: the chain **has** a locale link here, and where that link gets its value
is `LOCALE-2`'s business. A link that attaches a hard-coded `"en"` still satisfies `LOCALE-1`.

**Common business situations.** An anonymous client for public pages · an authenticated client for
the signed-in area · a separate client for uploads · a client assembled inside a script or a worker ·
a second client added for a new feature and copied from the old one **before** the locale was added
to the old one.

## `LOCALE-2` — derived from the address, never received as a parameter

**Situation.** The locale value has to come from somewhere. There are two kinds of source: the kind
somebody must **remember to pass**, and the kind that is **already available where the request is
assembled**. The law takes the second.

**What it emits in source.** A resolver that takes no locale argument. It reads the first path
segment and rejects a segment that is not a shipped locale rather than accepting whatever the default
narrowing returns. Public callers pass nothing.

**Recognition signs.**

- A hook with a `locale` parameter in its signature.
- A query function receiving `headers` from outside purely to slip the language in.
- An SWR key with `locale` appended "so the cache is right" — the sign that the locale is travelling
  by hand.

Ask: does this value arrive by being **derived**, or by being **passed**? If passed, what reminds the
next hook author? The address is the source because the URL already carries the reader's language and
the middleware already redirected them there. It is the strongest statement of intent and — more
importantly — the one nobody has to remember to forward. A forgotten parameter raises no error: the
call still succeeds and returns the default language.

**Boundary.** Against `LOCALE-1`: a link that exists but reads the wrong source is `LOCALE-2`; no link
at all is `LOCALE-1`. Against `LOCALE-3`: a cookie **is** a valid source for the link to read, since it
sits on the client side. `LOCALE-3` forbids the cookie as a **carrier** to the server; it does not
forbid it as a **source** read on the client. Against `LOCALE-4`: falling back to the app default
because there is no address to read is a closed branch of `LOCALE-2`; treating that default as "done"
is `LOCALE-4`.

**Common business situations.** A course-detail hook · a filtered list hook · a query function running
in a server component · a new hook copied from an old one · a shared link page carrying a language
prefix.

## `LOCALE-3` — a cookie does not cross an origin boundary

**Situation.** The app remembers the reader's choice in a cookie, and the server is perfectly capable
of reading that cookie. Both are true, and **neither** makes the value cross to another origin.

**What it emits in source.** In the file that builds the terminal HTTP link, `credentials` is
`"include"` only when the caller opts in, and it defaults to off — so the anonymous request, which is
nearly every read, sends no cookie. The header is therefore the only carrier that survives that path,
and the source must send it.

**Recognition signs.**

- The API sits on a different domain from the app.
- The chain sends anonymous requests, and the anonymous path deliberately does **not** enable
  credentials.
- Somebody is arguing "the server already reads the cookie" to conclude no header is needed.

Ask: on the exact path this request travels — anonymous, cross-origin — **is the cookie actually
sent**? This is the most expensive kind of correct: right in principle, wrong in fact. The server has
cookie-reading code, that code runs, and it never receives anything. Nobody sees an error; they only
see content in the wrong language. Do not fix it by enabling credentials — the anonymous path is
credential-free for its own reasons: sending cookies to a cross-origin API that has not opted in
produces CORS errors and drags in a different security scope. The fix is **to send the header**.

**Boundary.** Against `LOCALE-2`: a cookie as a client-side **source** is fine; a cookie as the
**carrier** to the server is not. Against `LOCALE-4`: `LOCALE-3` is the most common reason `LOCALE-4`
happens — nothing gets through, so the default comes back.

**Common business situations.** App and API on different domains · an API behind its own gateway · a
preview environment on a temporary domain · a request from a server component, which holds no browser
cookie · a request from a worker.

## `LOCALE-4` — the server's default is a floor, not a fallback

**Situation.** The server answers an undeclared request in its default language. That is the server
being **careful**, not the server granting **permission**.

**What it emits in source.** A resolver whose return type is the closed locale union, not an optional,
with no path that returns nothing — so there is no path that hands the server an undeclared request to
be careful about. Every request declares.

**Recognition signs.**

- The page runs, there is no error, the content is readable — just readable in another language.
- Somebody concludes "the fallback works fine".
- The tester and the real reader do not share a language.

Ask: is this answer right because **the request made it explicit**, or right because **I happen to
read the default language**? Treating the default as a fallback turns a missing header into an
**implicit product decision**: "readers of other languages can make do with the default". Nobody ever
decided that, and the only person who finds out is the one being served the wrong language.

**Boundary.** Against `LOCALE-1` and `LOCALE-3`: those two are the **cause**; `LOCALE-4` is **how
people wave the consequence through**. Against `LOCALE-2`: the no-address branch falling back to the
app default is a closed exception; relying on it on a branch that does have an address is `LOCALE-4`.

**Common business situations.** QA running everything in the default language · a smoke test that only
checks status 200 · a staging environment seeded in one language only · a bug report closed as "cannot
reproduce".

## `LOCALE-5` — one place writes the header, so one place can be checked

**Situation.** The language header is written by the locale link, and by nothing else. A call site
that sets it as well is a **second answer** to the same question.

**What it emits in source.** The header literal appears in exactly one production file — the locale
link — and its other occurrences are that file's own prose. A second production hit is the violation
itself.

**Recognition signs.**

- A `headers` object at the hook or query layer with a language key.
- A language constant hard-coded right at the call site.
- Two places in the repository containing that header string.

Ask: if the locale source changes tomorrow, **how many** places must I edit to be correct again? Two
answers are not harmless redundancy: they **diverge the first time** one of them is updated. The
typical result is one correct hook and the whole rest of the surface in the default language — exactly
the hardest state to diagnose, because there is evidence that "this part works".

**Boundary.** Against `LOCALE-1`: missing entirely is `LOCALE-1`; one place too many is `LOCALE-5`.
Against `LOCALE-2`: a call site that both sets the header and receives `locale` as a parameter
violates both; record both codes, do not choose one.

**Common business situations.** A hook "quick-patched" to make a release · a data seeding script · a
test helper copied into production · a request to a second endpoint written by hand outside the chain.

## Layer held

Which tier actually holds each code — a closed type, a lint rule, or only a reader. The enforced rows
are implemented by `@starci/eslint-canon-fe`.

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
know the NAME of. A link named `createAttachLocaleLink` that attaches `"en"` unconditionally satisfies
both rules and is wrong in exactly the way this law exists to prevent. That case is `LOCALE-2`, and it
is a review question by construction, not by omission.

`LOCALE-3` and `LOCALE-4` are further out of reach: one is a fact about the DEPLOYMENT (whether the
API is another origin), the other is a fact about an ANSWER the gate never sees. Neither is visible in
a source file at all.

The transport layer owns this concern. The component tree, the hooks and the query functions stay
ignorant of it: they neither derive the locale nor carry it, and the moment one of them does, the
concern has left its layer and the violation has a code.

## Anchor

A law that cannot be pointed at in real code is a proposal. Paths are repository-relative source
paths; the shape of the tree, not the name of any product, is what makes them checkable.

| Code | Anchor | What to look for |
|---|---|---|
| `LOCALE-1` | `modules/api/graphql/clients/create-apollo-client.ts` | The locale link is a plain element of the chain array — before the terminal link, outside the conditional spread that inserts the auth link. Adding auth adds exactly one link; the locale link is in both shapes |
| `LOCALE-2` | `modules/api/graphql/clients/links/locale.ts` | The resolver takes no locale argument. It reads the first path segment, and it rejects a segment that is not a shipped locale rather than accepting whatever the default narrowing returns. Public callers pass nothing |
| `LOCALE-3` | `modules/api/graphql/clients/links/http.ts` | `credentials` is `"include"` only when the caller opts in, and it defaults to off — so the anonymous request, which is nearly every read, sends no cookie. The header is the only carrier that survives that path |
| `LOCALE-4` | `modules/api/graphql/clients/links/locale.ts`, the resolver's return type and its no-address branch | The return type is the closed locale union, not an optional. There is no path that returns nothing, so there is no path that hands the server an undeclared request to be careful about |
| `LOCALE-5` | one search of the tree for the header literal | It appears in exactly one production file — the locale link — and its other occurrences are that file's own prose. A second production hit is the violation itself |

`LOCALE-4`'s anchor is the weakest of the five and is recorded as such: it proves the client always
declares SOMETHING, not that what it declared came from the reader.

## Inputs

| Input | Evidence required |
|---|---|
| call | The operation, and the transport chain it travels through |
| answer | Whether the response body differs per reader, or only the chrome around it does |
| origin | Whether the API is the same origin as the app |
| carrier | Where the value would ride: transport header, cookie, argument, or nothing |
| source | Where the value is derived: address, remembered choice, or app default |
| ownership | Which file writes the header |

## Rules

1. A chain that reaches the network declares a language.
2. The declaration is unconditional; a guest reads in a language too.
3. The locale is DERIVED where the request is assembled, never PASSED to it.
4. The address is the strongest available statement of intent, and the only one nobody has to remember
   to forward.
5. A cookie is not a carrier across an origin boundary the request does not opt into.
6. The server's default sits beneath a declaration; it is never the thing that decided.
7. Exactly one file writes the header.
8. Every call whose answer differs per reader resolves to exactly one code. No call is out of scope.

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
  client corrects it on re-fetch. The exemption is closed to that one branch, and its cost is real.

## Output

```text
call: <the operation, and the chain it travels through>
code: <LOCALE-1 | LOCALE-2 | LOCALE-3 | LOCALE-4 | LOCALE-5>
carrier: <transport header | cookie | argument | nothing>
source: <address | remembered choice | app default>
declared: <yes | no>
reason: <the fact that excludes the adjacent code>
```

## Worked example

The accepted shape: a public document-detail surface where an anonymous reader on a language-prefixed
address sees the document body itself in that language, not only the chrome around it.

The shape states that the answer differs per reader. It does not state which client assembles the
request, whether the API is the same origin as the app, what carries the value, or where the value is
derived — so it resolves none of those; this pattern does.

```text
call: document detail read, through the anonymous client chain in create-apollo-client.ts
code: LOCALE-1
carrier: transport header
source: address
declared: yes
reason: the chain assembles the terminal link, so it is a chain and not a link — the terminal-link file's exemption does not reach it, and the locale link sits outside the conditional auth spread, so no condition gates the attachment
```

```text
call: the locale link that the chain attaches, in links/locale.ts
code: LOCALE-2
carrier: transport header
source: address
declared: yes
reason: the resolver takes no locale argument and reads the first path segment, so the value is derived where the request is assembled rather than passed in — which is what separates this from LOCALE-1, where the question is only whether a link exists at all
```

```text
call: the same anonymous read, crossing to the API origin through links/http.ts
code: LOCALE-3
carrier: transport header
source: address
declared: yes
reason: credentials default to off on the anonymous path, so the remembered-choice cookie is never sent — the cookie remains a valid client-side source for the link to read, which is why this is LOCALE-3 and not LOCALE-2
```

```text
call: one search of the tree for the language header literal
code: LOCALE-5
carrier: transport header
source: address
declared: yes
reason: the literal occurs in one production file, the locale link, and nowhere else — a missing attachment would have been LOCALE-1, whereas one extra writer is LOCALE-5
```

```text
call: the server-rendered first pass of the same surface, with no address to read
code: LOCALE-4
carrier: transport header
source: app default
declared: yes
reason: the resolver's return type is the closed locale union with no path that returns nothing, so the default is a floor beneath a declaration rather than the thing that answered — treating the default answer as proof the fallback works is the LOCALE-4 failure this branch's closed exception does not license
```

## Scope

This rule holds for any code of this kind in this stack: any front end whose API serves translated
data. It names no product, no component library and no repository, and no single feature. Every
example is ordinary TSX.

AN IDENTIFIER THAT SHIPS IS NOT A PRODUCT NAME IN THIS SENSE. A rule is cited by its published name,
plugin prefix and all, because that is the exact string a build log prints and a disable comment
carries. A citation that cannot be pasted into a search is not a citation. What the ban above forbids
is PROSE and EXAMPLES that need a product to be understood — never an identifier somebody will read in
a failure and have to look up.
