# Comment

This file answers one question: given a frontend declaration or statement, does it carry a
comment, and what does that comment say?

Sources: `src/components/pages/AuthenticationPage/*`, `blocks/ai/StarCiAiChat/*`,
`blocks/ai/CourseAdvisorRecommendationCard/*`, `hooks/index.ts`, `hooks/swr/useQueryCourseSwr.ts`,
`hooks/swr/useMutateAddToCartSwr.ts`, `modules/api/graphql/queries/query-course.ts`,
`eslint.config.mjs`.

## FE-COMMENT-1 — Every export carries a docblock

415 of 417 non-spec component files contain a `/** */` block; lint `require-export-jsdoc` enforces
it.

| Case | When | Write |
| --- | --- | --- |
| Case 1 | A component | `/** Render the connected cart route. */` · `/** Draw every AI-owner state from resolved fixture data; no transport or translation lives here. */` |
| Case 2 | A props type | `/** Complete state/data/action contract for the pure advisor surface. */` · `/** Closed leaf props for a button-treatment sample. */` |
| Case 3 | A class-name export | `/** Messenger-like visual roles owned by the StarCi course-advisor surface. */` · `/** Grammar-owned page frame; this app alias adds no visual override. */` |
| Case 4 | A constant | `/** Canonical state inventory shared by connected owners and presentation tests. */` · `/** The key prefix, so a caller can revalidate every course read at once. */` |
| Case 5 | A route | `/** The routed authentication screen. The route mounts one page and makes no drawing decision. */` |

The one-liner states ownership or role ("owned by", "resolved by the connected owner", "no
transport lives here"), not the name.

## FE-COMMENT-2 — Fields are documented when the name is not enough

| Case | When | Write |
| --- | --- | --- |
| Case 1 | A handler | `/** Called after the panel establishes a session. */ readonly signedIn?: () => void` |
| Case 2 | A prop whose source matters | `/** URL-owned journey rendered before the browser hydrates stored challenge metadata. */ readonly initialMode?: AuthMode` |
| Case 3 | A hook param | `/** The short human-facing identifier the route carries - \`fullstack-mastery\`, not a UUID. */ displayId?: string` |
| Case 4 | A Grammar prop | `/** Pending belongs to the action that started the work and blocks duplicate presses. */ readonly isPending?: boolean` |
| Case 5 | Self-evident fields | `readonly id: string`, `readonly body: string` carry nothing |

## FE-COMMENT-3 — Decision prose on hooks and documents

Hooks and GraphQL modules carry multi-paragraph docblocks whose paragraphs open with a
capitalised claim and then give the measured reason.

| Case | When | Write |
| --- | --- | --- |
| Case 1 | A key decision | `THE DISPLAY ID IS PART OF THE KEY, which is what makes two course pages in one session safe: …` (`useQueryCourseSwr`) |
| Case 2 | A rejected alternative | `IT SENDS \`displayId\` AND NEVER \`id\`, and that is a measured decision rather than a preference. … The server answers that with \`success: false, error: COURSE_NOT_FOUND_EXCEPTION\`` |
| Case 3 | Why the key carries an argument | `THE KEY CARRIES THE COURSE, and it has to. Every hook sharing a key shares its state, so a grid of cards on one key is a grid where pressing ONE card puts every other card's control into the running state` (`useMutateAddToCartSwr`) |
| Case 4 | Selection rationale | `WHY THE CONTENT FACTS ARE SELECTED AND NOT ASKED FOR. …` (`query-course.ts`) |
| Case 5 | `@param` | `@param courseId - The course this hook's press is about, or \`undefined\` to stay idle.`; `@param input - {@link AuthenticationPageProps}` appears in one page and is not the norm |

## FE-COMMENT-4 — Line comments are sentences about why

201 `//` lines exist under `src/components` (non-spec). They sit above the statement and explain a
consequence; none restates the code.

| Case | When | Write |
| --- | --- | --- |
| Case 1 | A guard's reason | `// A server-rendered form has no React submit handler yet. Keeping its secret-bearing controls disabled until hydration prevents the browser's native GET fallback from placing an email, password or OTP in the URL when a reader acts before JavaScript attaches.` |
| Case 2 | Copy decision | `// The transport case deliberately does NOT say the details or the code were wrong, because nobody knows that - the request never got an answer.` |
| Case 3 | Cache decision | `// The sign-out drops every identity entry, whichever viewer it was cached under, and leaves every other cache namespace - and every non-tuple key - exactly where it was.` |
| Case 4 | Test stand-in | `// jsdom implements ranges but not their geometry, and the block asks a range where it is so the surface can be placed over it. A fixed rect is the honest stand-in: nothing here has layout.` |
| Case 5 | Config exception | the block comment above `files: ["src/modules/api/graphql/clients/options.ts"]` in `eslint.config.mjs` states why the exception lives in config and not inline |

## FE-COMMENT-5 — What a comment never contains

| Case | When | Write |
| --- | --- | --- |
| Case 1 | A second language | English only in source (lint `no-second-language-in-source`, `no-second-language-in-path`); user copy lives in `src/messages/{en,vi}.json` |
| Case 2 | Emoji | none (lint `no-emoji-in-source`) |
| Case 3 | A lint suppression | `eslint-disable` in 0 files; the config carries the exception with its reason |
| Case 4 | A restated name | `/** Props for CartPage. */` alone is not observed; the docblock adds what the page owns: `/** The page owns only the route-level composition; CartBlock owns cart state and actions. */` |
