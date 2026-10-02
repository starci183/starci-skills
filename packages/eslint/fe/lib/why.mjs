/**
 * The "why" of each rule the HFS catalogue assigns to this canon.
 *
 * WHERE IT IS SURFACED. An ESLint message is written for the developer at the terminal, in English,
 * and says what is wrong in the vocabulary of the rule. The agent that reads a failed land gate needs
 * the catalogue's sentence instead: the finding code (the key in `modules/kernel/failure-codes.yaml`)
 * and a headline and next step it can quote to the owner. This map is the canon's half of that
 * contract: `code` is the finding code, `en` the English source of the headline with `<file>` /
 * `<what>` placeholders the reader fills from the ESLint location, `fix` the one sentence "what do I
 * do now". The owner reads both in Vietnamese through the declared message catalog: the `en` and
 * `fix` strings are the keys of `modules/i18n/messages/v4.yaml`, so `translator('vi')(entry.en)` and
 * `translator('vi')(entry.fix)` hand back the Vietnamese of the same sentence.
 *
 * Every rule that carries a catalogue id (R18, R22, R49-R59, R60-R62, R65) has an entry;
 * the twin test refuses a rule of those laws with no entry and an entry for a rule that does not exist.
 */

/** @typedef {{ code: string, en: string, fix: string }} Why */

/** @type {Record<string, Why>} */
export const why = {
  "no-env-outside-config": {
    code: "FE_ENV_OWNER",
    en: "`<file>` reads an environment variable. Only `modules/config` may read env.",
    fix: "Read the value from a typed export of `modules/config` instead of `process.env`.",
  },
  "no-hardcoded-endpoint-fallback": {
    code: "FE_ENV_OWNER",
    en: "`<file>` carries a hardcoded fallback for an address or a secret (`?? \"http://localhost…\"`). A variable missing in production must throw at config load, not silently point at a dev machine.",
    fix: "Delete the fallback; let `modules/config` throw when a variable is missing in production.",
  },
  "fetch-only-in-api-client": {
    code: "FE_TRANSPORT_OWNER",
    en: "`fetch` (or `Request`, `EventSource`, `sendBeacon`, another HTTP library) in `<file>` sits outside the one client (`modules/api/client.ts`, or `src/client.ts` of the shared api package). A repo has exactly one transport.",
    fix: "Call the repo's client and receive `Outcome<T>`; do not call `fetch` yourself.",
  },
  "client-fetch-has-signal": {
    code: "FE_TRANSPORT_OWNER",
    en: "`fetch` in `<file>` has no `signal`. The client must carry a timeout and an `AbortSignal`.",
    fix: "Pass `signal` (`AbortSignal.timeout(...)` combined with the caller's signal).",
  },
  "no-shared-transport-state": {
    code: "FE_TRANSPORT_OWNER",
    en: "`<file>` holds shared state as `let`/`var` in the API layer. Token and locale must not sit in a singleton.",
    fix: "Pass credential and locale as parameters or through context.",
  },
  "client-maps-auth-to-refused": {
    code: "FE_HTTP_STATUS_COLLAPSE",
    en: "The client in `<file>` has no branch comparing `response.status` with 401 and 403 and returning `{ kind: \"refused\" }`, so the \"sign-in required\" state is never reached.",
    fix: "Add a `response.status === 401 || response.status === 403` branch returning `{ ok: false, kind: \"refused\" }` right inside the client.",
  },
  "no-failure-collapse": {
    code: "FE_HTTP_STATUS_COLLAPSE",
    en: "`<file>` merges every failure (an error HTTP response or a failed `Outcome`) into one branch or one empty value, so the reason is lost.",
    fix: "Keep the reason: for an `Outcome` branch on the reason code; for an HTTP response turn the status code into an `Outcome` (`refused` for 401/403, `not-found`, `invalid`, `unavailable`). Do not use the server's raw error as the reason.",
  },
  "no-hand-typed-wire": {
    code: "FE_WIRE_GENERATED",
    en: "`<file>` hand-types a wire type or casts a response. Use the types generated from `be/contracts/`.",
    fix: "Run codegen from the be contract snapshot (`be/contracts/`) and import the generated types; put GraphQL documents in `.graphql` files.",
  },
  "use-client-only-at-boundary": {
    code: "FE_CLIENT_BOUNDARY",
    en: "`\"use client\"` in `<file>` (`<slot>` may not be a client component).",
    fix: "Put `\"use client\"` on the `index.tsx` of an interactive block, a leaf, or `error.tsx`/`global-error.tsx`; keep layout and page as server components.",
  },
  "hooks-folder-holds-hooks-only": {
    code: "FE_HOOKS_ARE_HOOKS",
    en: "`<file>` inside `hooks/` is not a React hook. A server reader goes to `modules/api`, a helper to `<domain>.shared.ts`.",
    fix: "One hook per `use*.ts` file; a shared helper goes in `<domain>.shared.ts`; a server reader goes in `modules/api/<domain>/read-*.ts`.",
  },
  "no-middleware-file": {
    code: "FE_NEXT_CONVENTIONS",
    en: "`<file>` uses the name `middleware`. From Next 16 the request gate is `proxy.ts` exporting `proxy`.",
    fix: "Rename the file to `proxy.ts` and rename the export to `proxy`.",
  },
  "locale-segment-is-locale": {
    code: "FE_I18N_PLACEMENT",
    en: "File `<file>` sits under a locale segment that is not `[locale]`. There is one pattern: `next-intl`, `[locale]`, default `vi`.",
    fix: "Rename the segment directory to `[locale]`.",
  },
  "no-second-i18n-stack": {
    code: "FE_I18N_PLACEMENT",
    en: "`<file>` imports a second i18n library. The app uses only `next-intl` through `modules/i18n`.",
    fix: "Switch to `next-intl`; delete the other library.",
  },
  "html-lang-from-locale": {
    code: "FE_I18N_LITERAL",
    en: "`<html lang>` in `<file>` is a hardcoded string. The `lang` attribute must come from the `[locale]` segment.",
    fix: "Use `lang={locale}` from the parameter of the `[locale]` layout.",
  },
  "no-hardcoded-copy": {
    code: "FE_I18N_LITERAL",
    en: "The text `\"<text>\"` in `<file>:<line>` does not go through `t()`.",
    fix: "Move the sentence into `modules/i18n/messages/<locale>.json` and read it with `t(\"key\")`; no exceptions and no `vn-ok`.",
  },
  "no-raw-brand-value": {
    code: "FE_STYLE_TOKEN_ONLY",
    en: "`<file>` uses a raw colour/length value (`<what>`). Colour and spacing come only from grammar tokens; brand colour lives only in `brand.css`.",
    fix: "Use a grammar token class or variable; a colour value is declared only in `modules/brand/brand.css`.",
  },
  "status-text-uses-soft-foreground": {
    code: "FE_STYLE_TOKEN_ONLY",
    en: "`<file>` paints text or an icon with a solid status tone (`<what>`, e.g. `text-success`). A solid tone is a background colour; used as a text colour it reads below 4.5:1 on the page background.",
    fix: "Switch to the soft pair: `text-<tone>-soft-foreground` (with `bg-<tone>-soft` when it sits on a light surface); a solid tone is used only with `bg-<tone>` and `text-<tone>-foreground`.",
  },
  "no-native-form-control": {
    code: "FE_NATIVE_FORM_CONTROL",
    en: "Raw `<tag>` in `<file>`. Use the grammar renderer.",
    fix: "Replace it with the grammar component; if none exists yet, add it to grammar instead of drawing it in place.",
  },
  "component-line-budget": {
    code: "FE_SIZE_AND_STATE_BUDGET",
    en: "`<file>` is `<n>` lines long, over the 300-line budget of a component.",
    fix: "Split the drawing part from the data part and each area into its own unit.",
  },
  "unit-hook-budget": {
    code: "FE_SIZE_AND_STATE_BUDGET",
    en: "`<unit>` has `<n>` data hooks / `<m>` useState, over the budget of 6.",
    fix: "Fold state that changes together into a reducer or a dedicated hook; split each data area into its own connection block.",
  },
  "no-hand-rolled-polling": {
    code: "FE_SIZE_AND_STATE_BUDGET",
    en: "`<unit>` hand-writes a poll loop (`setInterval` or a self-rescheduling `setTimeout`).",
    fix: "Refresh through a data hook (`refreshInterval`) or a socket, one mechanism per resource.",
  },
  "no-inline-lint-config": {
    code: "HFS_INLINE_SUPPRESSION",
    en: "A comment disabling a rule sits at `<file>:<line>`. HFS does not allow in-place suppression - fix the code, or propose a rule change.",
    fix: "Remove `eslint-disable`, `@ts-ignore`, `@ts-expect-error` or `vn-ok` and fix the cause.",
  },
  "no-double-cast": {
    code: "FE_TYPE_ESCAPE",
    en: "`<file>` casts through `unknown` (`as unknown as T`): the compiler forgets everything it knows right where the data enters.",
    fix: "Narrow from `unknown` with a type guard or a parser; do not cast.",
  },
  "no-type-assertion": {
    code: "FE_TYPE_ESCAPE",
    en: "`<file>` uses `as T` or `<T>x`: an assertion the compiler cannot check. If it is wrong, the error lands in the user's browser.",
    fix: "Narrow with a type guard, `in`, a discriminant or a parser where the data enters; use `satisfies` when you only mean to check a literal.",
  },
  "no-non-null-assertion": {
    code: "FE_TYPE_ESCAPE",
    en: "`<file>` uses `x!`: asserting a value is present without proving it.",
    fix: "Handle the absent branch (`if`, `??`, an early return) or fix the type so the value cannot be absent.",
  },
  "no-explicit-any": {
    code: "FE_TYPE_ESCAPE",
    en: "`<file>` uses `any`: it switches off type checking for that value and for everything inferred from it.",
    fix: "Use a real type, a generic, or `unknown` narrowed at the use site.",
  },
  "list-item-has-key": {
    code: "FE_LIST_KEY",
    en: "An element returned from `.map` in `<file>` has no `key`, so React identifies the row by position and the row loses state on delete or reorder.",
    fix: "Add a `key` taken from the data's id; for a fragment use `<Fragment key={...}>`.",
  },
  "no-index-key": {
    code: "FE_LIST_KEY",
    en: "A `key` in `<file>` comes from the `.map` index or a randomly generated value; an index is a position, not an identity.",
    fix: "Use the id the data carries (`key={row.id}`); never the index, `Math.random`, `Date.now`.",
  },
  "no-inline-literal-prop-in-list": {
    code: "FE_LIST_KEY",
    en: "A component in a `.map` in `<file>` receives an object or array literal as a prop: every row gets a new value every render, so memo never hits.",
    fix: "Hoist the constant outside the component or build it once before `.map`.",
  },
  "effect-subscription-needs-cleanup": {
    code: "FE_EFFECT_CLEANUP",
    en: "`<what>` in `<file>` (timer, frame, listener, observer, socket or subscription) is started by an effect or `subscribe` but the returned cleanup does not release that same handle/target/listener.",
    fix: "Keep the handle and return a cleanup calling `clearTimeout(id)`, `cancelAnimationFrame(id)`, `removeEventListener` with the same type and listener, `.disconnect()`, `.close()` or `.unsubscribe()` on the right object.",
  },
  "no-data-fetch-in-effect": {
    code: "FE_EFFECT_FETCH",
    en: "`useEffect` in `<file>` starts a promise (`await`, `fetch`, `.then`, `void load()`, `mutate()`/`refresh()` called directly): no cache, no request merging, no loading/error state, no abort. Freshness of data comes from the SWR key, not from an effect.",
    fix: "Read on the client with SWR calling the app's client (`hooks/`) keyed by what changes; call `mutate()` from the event that changes the data (handler, socket message); on the route use the server reader `modules/api/<domain>/read-*.ts`.",
  },
  "no-empty-catch": {
    code: "FE_SWALLOWED_ERROR",
    en: "A `catch` or `.catch` in `<file>` does nothing: the error vanishes, no notice, no trace.",
    fix: "Return a typed outcome carrying the cause, show an error state, or rethrow.",
  },
  "no-console": {
    code: "FE_CONSOLE_CALL",
    en: "`console.<method>` in `<file>`: it reaches no log pipeline and leaks internal detail to the user.",
    fix: "Return a typed outcome, show an error state, or let the error reach `error.tsx`.",
  },
  "page-exports-metadata": {
    code: "FE_PAGE_METADATA_MISSING",
    en: "`<file>` is `page.tsx` but exports no `metadata` or `generateMetadata`; every page in the branch carries the same title.",
    fix: "Export `metadata` (or `generateMetadata` when the title comes from data) with a title and description taken from the message catalog.",
  },
  "no-null-suspense-fallback": {
    code: "FE_SUSPENSE_NULL_FALLBACK",
    en: "`<Suspense>` in `<file>` has an empty `fallback`: the user sees a blank instead of a loading state.",
    fix: "Pass the skeleton (loading state) of the very thing loading as the `fallback`.",
  },
  "navigation-from-intl": {
    code: "FE_I18N_NAVIGATION",
    en: "`<file>` imports `Link`, `useRouter`, `usePathname` or `redirect` from Next, which does not know the locale: the path loses the `[locale]` prefix.",
    fix: "Import from `modules/i18n/navigation`, built by next-intl from `routing.ts`.",
  },
  "no-native-anchor": {
    code: "FE_I18N_NAVIGATION",
    en: "`<a>` in `<file>` points at an internal route (reloads the whole page, loses the locale, loses prefetch) or opens a new tab without `rel`.",
    fix: "Use `Link` from `modules/i18n/navigation` with an href built by `modules/routes`; a `_blank` link adds `rel=\"noopener noreferrer\"`.",
  },
  "use-intl-formatter": {
    code: "FE_I18N_FORMATTER",
    en: "`<file>` formats a number, money or a date with `toLocale*String`, `new Intl.*`, `toFixed`, a currency sign pasted into a template or a date library, instead of the next-intl formatter.",
    fix: "Use `useFormatter()` (or `getFormatter()` on the server): `number(...)`, `dateTime(...)`, `relativeTime(...)`.",
  },
  "no-hardcoded-route": {
    code: "FE_ROUTE_HARDCODED",
    en: "`<file>` writes a route path inline at the call site; when the route moves, the copy points at a 404.",
    fix: "Build the href with a function of `modules/routes` and use that same function everywhere.",
  },
  "client-no-server-import": {
    code: "FE_CLIENT_SERVER_IMPORT",
    en: "A client component in `<file>` imports code that exists only on the server (`server-only`, `next/headers`, a Node module, a server reader).",
    fix: "Read the data in a server component or a server reader and pass it down as props; or use SWR calling the app's client.",
  },
  "server-module-marks-server-only": {
    code: "FE_SERVER_ONLY_MARK",
    en: "Module `<file>` imports a server-only API (`next/headers`, `next/server`, `next-intl/server`, a Node module or an already server-only module) but does not open with `import \"server-only\"`.",
    fix: "Make `import \"server-only\"` the file's first statement; route files (`page`, `layout`, `route`, `proxy`) are server components already and need none.",
  },
  "web-storage-only-in-modules": {
    code: "FE_STORAGE_OUTSIDE_MODULES",
    en: "`<file>` uses `localStorage`/`sessionStorage` outside `modules/`; storage does not exist on the server and throws when over quota.",
    fix: "Put the read/write behind a hook or a module in `modules/` with a guard (`typeof window`, try/catch) and call it from the block.",
  },
  "no-dangerous-html": {
    code: "FE_DANGEROUS_HTML",
    en: "`dangerouslySetInnerHTML` on `<tag>` in `<file>`: any string becomes runnable HTML.",
    fix: "Render content as elements; only a `<script>` carrying JSON-LD or theme code from an app constant may use it.",
  },
  "response-cookie-attributes": {
    code: "FE_COOKIE_ATTRIBUTES",
    en: "`<file>` writes a cookie through the Next response cookie without stating fixed `httpOnly`, missing `secure` or a `sameSite` that is not `lax`/`strict`.",
    fix: "Pass one `as const` options constant of the module owning the cookie: `httpOnly: true` (`false` only for a cookie an optional script must read), `secure` from `modules/config`, `sameSite: \"lax\"` or `\"strict\"`.",
  },
  "props-fields-readonly": {
    code: "FE_PROPS_MUTABLE",
    en: "A props type of a component in `<file>` has a field or collection that is not `readonly`, so the component could write into what it is passed.",
    fix: "Mark every field and index signature `readonly`, and write collections as `readonly T[]`, `readonly [A, B]` or `ReadonlyArray<T>`.",
  },
  "no-native-img": {
    code: "FE_NATIVE_IMAGE",
    en: "Raw `<img>` in `<file>`: it loads the original image and holds no space, so the page jumps when the image arrives.",
    fix: "Use `Image` of `next/image` with `width` and `height` (or `fill` and `sizes`) and an `alt` from the catalog.",
  },
  "image-has-size": {
    code: "FE_NATIVE_IMAGE",
    en: "`Image` in `<file>` lacks `width` and `height` (or has `fill` without `sizes`): the browser cannot hold the space.",
    fix: "Give both `width` and `height`, or `fill` inside a sized frame with `sizes`.",
  },
  "outcome-kinds-exhaustive": {
    code: "FE_OUTCOME_KIND_UNHANDLED",
    en: "A `switch` on `kind` in `<file>` has an `ok` branch but misses one of refused, invalid, not-found, unavailable.",
    fix: "Write all five branches of `Outcome<T>`, one screen each; do not lean on `default`.",
  },
  "one-outcome-union": {
    code: "FE_HTTP_STATUS_COLLAPSE",
    en: "`<file>` declares another result union (`ok` or `kind`) outside `outcome.ts`. A repo has only one `Outcome<T>`.",
    fix: "Use `Outcome<T>` of `modules/api/outcome.ts` (or the shared api package); add business detail through the second parameter instead of declaring a new union.",
  },
  "i18n-stack-in-one-module": {
    code: "FE_I18N_PLACEMENT",
    en: "`<file>` builds a layer of the next-intl stack itself (`defineRouting`, `createNavigation`, `getRequestConfig`, `createMiddleware`). The stack is written once for the whole repo.",
    fix: "Call the `createAppI18n` factory of the shared i18n package inside `modules/i18n/index.ts` and import the result; a single-app repo writes the stack only in that app's `modules/i18n`.",
  },
  "no-raw-structural-element": {
    code: "FE_NATIVE_FORM_CONTROL",
    en: "Raw `<tag>` in `<file>`. Page structure and text are composed from grammar components, not hand-written HTML.",
    fix: "Replace it with the matching grammar component (`Heading`, `Text`, `SurfaceCard`, ...); if grammar lacks it, add it to grammar or the ui package instead of drawing it in place.",
  },
  "file-size-growth": {
    code: "HFS_SIZE_GROWTH",
    en: "`<file>` exceeds the line budget: a new file already too long, or an existing file longer than at the parent commit. Every file must be small enough for one person to read through and one test to cover.",
    fix: "Split the new part into its own file by responsibility; a file already over budget may only stay or shrink.",
  },
}
