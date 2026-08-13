# served locale

## Definition

Some data is translated on the server. A course document, a content body, a category name — the API
stores one per locale and hands back the one it was asked for. Which means the request has to ask,
and a request that says nothing gets the server's default, forever, in every language.

This is not the same law as [`translation`](translation.md). That one settles **who chooses the
word** inside the component tree: the connected half resolves copy, nothing below a block says a word
of its own. This one settles **what the request declares** on its way out. A screen can obey
`translation` perfectly — every label resolved, no literal below a block — and still show a
Vietnamese reader an English course, because the chrome came from the dictionary and the content came
from an API that was never told which language to serve.

The question that settles whether something belongs here: **would a reader in another language get
different DATA back from this call?** If yes, the request must declare the locale, and it must
declare it in one place rather than at each call site.

What holds this law is [`sources/fe/served-locale.mjs`](../../../sources/fe/served-locale.mjs).

Implementation anchors in `starci-academy-fe`:
`src/modules/api/graphql/clients/links/locale.ts` and
`src/modules/api/graphql/clients/create-apollo-client.ts`.

## Rules

**LOCALE-1 · The client attaches the locale, and every client does.**

The locale rides in the transport chain beside the auth token, not in the hook that happens to need
it. Attaching it per call means the whole surface is bilingual only while every author remembers,
and the first one who forgets ships a page that is bilingual in its chrome and monolingual in its
content — which reads as a translation gap rather than a missing header, so it is looked for in the
dictionary.

A guest reads in a language too, so this is unconditional. Unlike the bearer token, there is no
anonymous path that legitimately declares nothing.

**LOCALE-2 · The transport reads the locale from the address, not from an argument.**

The URL already carries the reader's language, and a middleware already redirected them to it. That
makes the address the strongest available statement of intent and, more usefully, one nobody has to
remember to pass. A `locale` parameter threaded through hooks and query functions is a parameter the
next hook omits, and the omission is invisible: the call succeeds and returns the default language.

**LOCALE-3 · A cookie is not transport when the API is another origin.**

The app may well remember the reader's choice in a cookie, and the server may well read one. Neither
fact carries the value across an origin boundary: a cross-origin request sends no cookie unless it
opts into credentials, and the anonymous path deliberately does not. A cookie the server can read in
principle and never receives in practice is the most expensive kind of correct.

**LOCALE-4 · The server's default is a floor, not a fallback the client may lean on.**

A server that answers an undeclared request with English is being careful, not permissive. Treating
that default as "the fallback works" turns a missing header into a silent product decision, and the
reader who notices is the one being served the wrong language.

**LOCALE-5 · One place sets the header, so one place can be checked.**

The header is written by the link and by nothing else. A second call site setting it by hand is a
second answer to "which locale is this request in", and the two disagree the first time one of them
is updated.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| A GraphQL client assembled without the locale link | Every call it makes is served the default language, and the gap reads as a translation bug | Put the locale link in the chain, beside the auth link |
| Attaching the locale per hook or per query | The first author who forgets ships a monolingual surface, and nothing reports it | Attach it once in the transport |
| Threading a `locale` argument through hooks | It is a parameter that gets omitted, and omission returns the default rather than an error | Read the address in the link |
| Relying on the cookie to reach a cross-origin API | It is not sent unless the request opts into credentials, and the anonymous path does not | Send the header |
| Treating the server default as the fallback | It converts a missing header into a silent product decision | Declare the locale on every request |
| Setting the locale header at a call site | Two answers to one question, and they diverge on the first edit | Let the link own it |

## Examples

### Where the locale is attached

```ts
// the chain: unconditional, beside the auth link, so every call declares a language
export const createLinkChain = (params) => [
    createRetryLink(),
    createTimeoutLink(),
    createAttachLocaleLink({ debug }),
    ...(withAuth ? [createAttachBearerTokenLink({ debug })] : []),
    createHttpLink({ uri, headers, signal }),
]
```

```ts
// Wrong: the chain is complete, authenticated, retried, timed out - and mute about language
export const createLinkChain = (params) => [
    createRetryLink(),
    createTimeoutLink(),
    ...(withAuth ? [createAttachBearerTokenLink({ debug })] : []),
    createHttpLink({ uri, headers, signal }),
]
```

They differ in one thing: whether a reader on a Vietnamese URL is served a Vietnamese document.

### Where the locale comes from

```ts
// the link reads the address, so no caller has to remember anything
const locale = localeFromPath(window.location.pathname) ?? localeFromCookie(document.cookie) ?? DEFAULT_LOCALE
```

```ts
// Wrong: correct at this call site, and the next hook will not pass it
export const useQueryCourseSwr = ({ displayId, locale }) =>
    useSWR([KEY, displayId, locale], () => queryCourse({ request: { displayId }, headers: { "x-locale": locale } }))
```

They differ in one thing: whether being right depends on every future author remembering.

### The header nobody should write twice

```ts
// one link owns it
operation.setContext((previous) => ({ headers: { ...previous.headers, "x-locale": locale } }))
```

```ts
// Wrong: a second answer to the same question, in a file that will not be updated with the first
const result = await queryCourse({ request, headers: { "x-locale": "vi" } })
```

They differ in one thing: how many places have to agree for the answer to be right.
