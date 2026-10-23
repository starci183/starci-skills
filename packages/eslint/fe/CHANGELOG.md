# Changelog

## Unreleased
- Added: the type-aware rules the back end already borrowed, at error: `@typescript-eslint/no-floating-promises`, `no-misused-promises`, `switch-exhaustiveness-check` and the `no-unsafe-assignment`, `-member-access`, `-call`, `-return`, `-argument` family.
- Changed: no Sonar way rule is left to the server (owner ruling 2026-10-22, no loosening): S3403, S3800, S3782 and S6582 run at error, `unicorn/consistent-function-scoping` runs with its default options, and S7785 (`unicorn/prefer-top-level-await`) runs in the front end (ESM).
- Added: `starciPlainSourceConfig({ root })` for a TypeScript front-end tree that is no HFS app (a runtime package, the harness UI): typed linting, the inline-directive fence, the React Hooks, type-aware and Sonar way rules and every canon rule that needs no slot view (`SLOT_FREE_RULES`), all at error.

## 8.4.29 - 2026-10-22
- Changed: the bundled canon pins select @starci/hfs 4.7.23 and @starci/cli 1.7.23.

## 8.4.28 - 2026-10-22
- Changed: the bundled canon pins select @starci/hfs 4.7.21 and @starci/cli 1.7.21.

## 8.4.27 - 2026-10-22
- Fixed: Sonar way parity with the server: the injected-constructor-aware `max-params` (S107) replaces core `max-params`, and the ports that report what the server does not on the same source (S1481 `no-unused-vars`, S3403 `different-types-comparison`, S3782 `argument-type`, S3800 `function-return-type`, S6582 `prefer-optional-chain`) are left to the server; NIVO (0 issues on the server) lints at 0 instead of 205 under 1.7.19.
- Changed: the bundled canon-pins and failure-code copies follow the 1.7.20 cohort; lint behavior is unchanged.

## 8.4.26 - 2026-10-21
- Changed: supersedes 8.4.25 (app lint broken: the canons' Sonar way block carries its own ignores, which `starci app lint` refused as an unsupported source scope, so it exited 2 without running ESLint and reported 0 findings); 8.4.25 is not used.
- Changed: the bundled canon-pins copy follows the 1.7.19 cohort (cli 1.7.19, hfs 4.7.19); lint behavior is unchanged.

## 8.4.25 - 2026-10-21
- Changed: supersedes 8.4.24, published from a lane whose history the owner refused (an unapproved allowlist entry) and therefore a superseded orphan that is not used; this version carries the same work plus the standalone scaffold fix.
- Added: Sonar way at lint time: every rule of the Sonar way TypeScript profile with an ESLint equivalent is on at error over the files the scan judges (a unit or end-to-end spec is outside), from the shared `scripts/lib/sonar-way.mjs`: eslint-plugin-sonarjs' Sonar way set (cognitive complexity 15, super-linear and slow regex, sort compare, nested template literals, ...) and the rules SonarSource builds on (`max-params` 7, `no-duplicate-imports`, `@typescript-eslint/prefer-optional-chain`, unicorn's `prefer-native-coercion-functions`, `prefer-includes`, `prefer-set-has` and the other S77xx rules). New exact dependencies eslint-plugin-sonarjs 4.2.1 and eslint-plugin-unicorn 65.0.0 (the last line for ESLint 9).
- Added: `media-has-caption` (S4084): a `<video>` or `<audio>` element carries a captions track or is muted.
- Changed: the bundled canon-pins copy follows the 1.7.18 cohort (cli 1.7.18, hfs 4.7.18, jest-preset 2.3.4).

## 8.4.23 - 2026-10-21
- Changed: the bundled canon-pins copy follows the 1.7.16 cohort (cli 1.7.16, hfs 4.7.16); lint behavior is unchanged.

## 8.4.22 - 2026-10-21
- Changed: bundled runtime copies carry slot manifest 3.4.0 (`be.contract.mcp-tools`); lint behavior is unchanged; canon pins follow the matching package cohort.

## 8.4.21 - 2026-10-20
- Changed: republished for the complete 1.7.14 cohort; 8.4.20 was published while @starci/hfs 4.7.14 and @starci/cli 1.7.14 stopped at their clean proof, so it is a superseded orphan and is not used. Content equals 8.4.20 apart from the canon pins.

## 8.4.20 - 2026-10-20
- Changed: bundled runtime copies carry the HFS hooks-installed check (`HFS_HOOKS_NOT_INSTALLED`); lint behavior is unchanged; canon pins follow the matching package cohort.

## 8.4.19 - 2026-10-20
- Fixed: bundled runtime source clears the SonarCloud code smells of alpha.23 (regex complexity, concise classes, string prefix and suffix checks, block braces, optional chaining, export-from, default parameters, synchronous awaits, dead stores) without behavior change; canon pins follow the matching package cohort.

## 8.4.18 - 2026-10-19
- Fixed: bundled runtime source analysis retains nullable contracts and explicit callback arguments; canon pins follow the matching HFS and CLI cohort.

## 8.4.17 - 2026-10-19
- Changed: bundled canon pins follow the native CLI and HFS provisioning cohort; front-end lint rules are unchanged.

## 8.4.16 - 2026-10-19
- Changed: bundled canon pins follow the regenerated Stylelint vocabulary and the matching HFS and CLI cohort; front-end canon rules are unchanged.

## 8.4.15 - 2026-10-19
- Changed: bundled canon pins follow @starci/hfs 4.7.9, @starci/cli 1.7.9 and the matching lint canon cohort for the lite development guidance update; front-end canon rules are unchanged.

## 8.4.14 - 2026-10-19
- Changed: bundled runtime and canon pins follow @starci/hfs 4.7.8, @starci/cli 1.7.8 and the matching lint canon cohort for the catalog provenance repairs; front-end canon rules are unchanged.

## 8.4.13 - 2026-10-19
- Fixed: shared import classification selects an existing module file before virtual slot inference, so public auth barrels retain their resolved owner while impure redirect helpers remain refused.

## 8.4.11 - 2026-10-18
- Changed: bundled canon pins follow @starci/hfs 4.7.5 and @starci/cli 1.7.5 for the managed Codecov coverage scope correction; canon rules are unchanged.

## 8.4.10 - 2026-10-18
- Changed: bundled canon pins follow @starci/hfs 4.7.4 and @starci/cli 1.7.4 for the Sonar analyzer heap property correction; canon rules are unchanged.

## 8.4.9 - 2026-10-18
- Changed: bundled canon pins advance with both lint canons after the interrupted alpha.22 package publication; canon rules are unchanged.

## 8.4.8 - 2026-10-18
- Changed: bundled runtime pins follow @starci/hfs 4.7.3 and @starci/cli 1.7.3 for the alpha.22 typecheck heap repair; canon rules are unchanged.

## 8.4.7 - 2026-10-18
- Changed: bundled runtime copies follow the alpha.22 re-cut (canon pins hfs 4.7.2, cli 1.7.2, jest-preset 2.3.2); canon rules are unchanged.

## 8.4.6 - 2026-10-18
- Changed: bundled runtime copies follow the alpha.22 re-cut (canon pins hfs 4.7.1, cli 1.7.1); canon rules are unchanged.

## 8.4.5 - 2026-10-18
- Changed: bundled runtime copies follow runtime 1.0.0-alpha.22 (failure codes, the rule catalog with R301 and the candidate trigger laws, canon pins); canon rules are unchanged.

## 8.4.4 - 2026-10-18
- Changed: bundled runtime copies follow runtime 1.0.0-alpha.21 (canon pins, failure codes, the narrowed secret patterns); canon rules are unchanged.

## 8.4.3 - 2026-10-18
- Changed: bundled runtime copies include the refreshed canon pins for the alpha.20 patch set; canon rules are unchanged.

## 8.4.2 - 2026-10-17

- Changed: bundled runtime copies follow runtime 1.0.0-alpha.20, including the canon pins and shared architecture checks.

## 8.4.1 - 2026-10-17

- Changed: the bundled runtime copies follow the runtime of 1.0.0-alpha.19 (owner ruling no-runtime-specs, 2026-10-17): the failure codes, the slot manifest (`exampleNa`) and the rule catalog (`specNa`, `exampleNa`) carry the removal of the runtime's own specs; package behavior is unchanged.
- Changed (R287 `FE_CALLBACK_SHAPE`, a18.1 NIVO request F2, owner ruling `auth-callback-pure-helpers`): the auth callback may call pure text helpers of the app's `modules/routes` or `modules/auth` (`requestOrigin`, `safeNextPath`; resolved by TypeScript symbol: synchronous, no await, no I/O global, only owner helpers and `modules/config` readers), use static route tables (`AUTH_ROUTES`), and read the exchange outcome's `success` or `ok` flag. An impure, async or non-text helper, a helper outside those owners and a credential passed to a helper are still refused.
- Changed (R287 `FE_CALLBACK_SHAPE`, a18.1 NIVO request F, owner ruling `auth-callback-email-link`): the auth callback may await one `verifyOtp({ token_hash, type })` of the auth owner (`auth.verifyOtp` or `verifyOtp` from `modules/auth/server`), built from exactly the query values `token_hash` and `type`, beside the one `exchangeAuthCode(code)`; the token hash never reaches a redirect.
- Fixed (R55 `FE_CLIENT_BOUNDARY`, a18.1 NIVO request I): the finding on a page or layout owner now says the owner stays a server component that renders the client block or overlay carrying the directive. The rule is unchanged.

## 8.3.0 - 2026-10-15
- Changed: layouts may import overlays beside pages (tier edge `feature -> feature` from pages and layouts to overlays); a layout hosts the route-selected overlay through `components/branches/OverlayHost` while pages stay server components (pattern FE-BOUNDARY-5). Carries the runtime mirror of the manifest and pins, rebased onto alpha.13 (eslint-canon-fe 8.2.18).

## 8.2.17 - 2026-10-14
- Changed: `component-line-budget` gives a pure re-export `index.ts` the slot's `barrel` budget (400); `basePropsAtom` admits named `render*` callbacks in `props` of non-block pure halves for feature composition; the bundled machine carries the kind-scoped feature tier edge, canon-shape clone exclusions and in-segment i18n template reads.


- Changed: carry the runtime mirror of HFS manifest 3.1.0 (the back-end app composition standard, R245 and R246) and the canon pins of eslint-canon-be 3.3.0, HFS 4.3.0 and CLI 1.2.16. ESLint rule implementations are unchanged.

## 8.2.18 - 2026-10-14

- Changed: carry the canon pins of eslint-canon-be 3.2.19, HFS 4.2.17 and CLI 1.2.17 in the runtime mirror. ESLint rule implementations are unchanged.

## 8.2.17 - 2026-10-14

- Fixed: `dead-exports` (`HFS_UNUSED_EXPORT`) counts an import by another public entry the slot declares in `entries` as a use: a `graphql/{queries,mutations}/types/<x>.ts` export its operation file `query-<x>.ts`/`mutation-<x>.ts` imports is part of that operation's signature and is no longer reported. A barrel or any other non-entry file of the owner still does not count, so an operation reached only through a re-export of `modules/api/index.ts` stays dead.

## 8.2.16 - 2026-10-13

- Changed: the heroicons family is the one application icon set again (owner ruling 2026-10-13): `heroicons-is-the-glyph-vendor` admits exactly `@heroicons/react/24/outline`, `@heroicons/react/16/solid` and the matching `@starci/heroicons` subpaths (read from the fe-stack `icons` concern), and refuses Phosphor and every other glyph catalogue, a package the catalog forbids included; `one-icon-set` (8.2.15) is gone. Only the Icon leaf and the toast module import a glyph. The bundled runtime mirror carries the fe-stack catalog and the canon pins with `@heroicons/react` 2.2.0 and `@starci/heroicons` 0.3.3.

## 8.2.15 - 2026-10-13

- Changed: carry the runtime mirror of HFS manifest 3.0.0 (one front-end standard for the lite and the full edition, owner ruling 2026-10-13) and the canon pins for Grammar 0.9.14, HFS 4.2.14, jest-preset 2.2.7 and CLI 1.2.14.
- Added: `fe-stack-import` (law `fe-stack`, finding code `FE_STACK_FORBIDDEN`): an import (static, re-export, dynamic, `require`, type-only included) of a package any concern of the fe-stack catalog (`runtime/knowledge/hfs/fe-stack.yaml`) forbids, and `@supabase/*` outside `modules/auth` (slot `fe.modules.auth`), are refused. The catalog is read from the runtime copy; a missing copy stops the lint run with the fix.
- Changed: the transport law follows the Apollo GraphQL + axios API layer. `fetch` (and `Request`, `EventSource`, `sendBeacon`) is legal in every file of the API layer (`modules/api`, the shared api package), `@apollo/client` only there, `axios` only in its REST calls (`modules/api/rest/`), `socket.io-client` only in `hooks/socketio/` (`fetch-only-in-api-client`, message `placed`); `client-fetch-has-signal` and `no-shared-transport-state` judge the whole layer (the generated `graphql/__generated__/` excepted); `no-hand-typed-wire` admits GraphQL documents in the API layer (one file per operation) and refuses them elsewhere; `one-outcome-union` names `GraphQLResponse` in `modules/api/graphql/types.ts` as the one vocabulary and also reads a `success` discriminant. The `modules/db` outcome home and the server reader role are gone.
- Changed: `hooks-folder-holds-hooks-only` judges the hooks families `hooks/{swr,rhf,zustand,socketio,effects,reuseables}` by the files their slots name (message `family`); `SwrSideEffects.tsx` and `SocketIoSideEffects.tsx` are legal `.tsx` files of `hooks/`.
- Changed: `use-client-only-at-boundary` admits the client state a layout mounts once (`components/providers/<name>/index.tsx`, `redux/ReduxProvider.tsx`, `modules/toast/toast.tsx`, the two side-effect components); `client-no-server-import` and `server-module-marks-server-only` drop the server reader role.
- Changed: `presentational-purity` recognises the stack's data, form, state, socket and toast hooks (`use{Query,Mutate,Get,Post,Put,Patch,Delete}<X>Swr`, `use<X>Form`, `useForm`, `useAppDispatch`, `use<X>SocketIo`, `use<X>WithToast`, the Apollo hooks); the served-locale rules find the links of the Apollo clients folder and read the header name case-insensitively; `use-intl-formatter` admits `dayjs` in `modules/dayjs`.
- Changed: `heroicons-is-the-glyph-vendor` is replaced by `one-icon-set`: product glyphs come only from the fe-stack icon set (`@phosphor-icons/react`, subpaths included); Heroicons and `@starci/heroicons` are refused like any second catalogue. A package the catalog forbids by name (date libraries, i18n stacks, glyph sets, transports) is reported once, by `fe-stack-import`.

## 8.2.14 - 2026-10-12

- Changed: carry the merged runtime mirror and canon pins for Grammar 0.9.13, Stylelint canon 2.0.9, HFS 4.2.13 and CLI 1.2.13. The bundled HFS manifest 2.2.0 recognizes declaration-only ambient owners; ESLint rule implementations are unchanged.

## 8.2.13 - 2026-10-12

- Changed: bundled canon pins carry @starci/grammar 0.9.12 (the secondary tab track keeps its padding).

## 8.2.12 - 2026-10-12

- Changed: bundled canon pins carry @starci/grammar 0.9.11 (secondary Tabs are HeroUI's own pill tabs).

## 8.2.11 - 2026-10-12

- Changed: bundled canon pins carry @starci/grammar 0.9.10 (the grammar ships without spec suites).

## 8.2.10 - 2026-10-12

- Changed: refresh the bundled canon pins for CLI 1.2.9, HFS 4.2.9 and the BE lint canon 3.2.10 after correcting the CLI runtime install pin; ESLint rule implementations are unchanged.

## 8.2.9 - 2026-10-12

- Changed: refresh the bundled runtime and canon pins for grammar 0.9.9, stylelint-canon 2.0.8, CLI 1.2.8 and HFS 4.2.8; ESLint rule implementations are unchanged.

## 8.2.8 - 2026-10-12

- Changed: refresh the bundled canon pins for grammar 0.9.8; behaviour is unchanged.

## 8.2.7 - 2026-10-12

- Changed: refresh the bundled canon pins for grammar 0.9.7 and heroicons 0.3.3; behaviour is unchanged.

## 8.2.6 - 2026-10-11

- Changed: refresh the bundled canon pins for CLI 1.2.5 and HFS 4.2.5; command and lint behavior is unchanged.

## 8.2.5 - 2026-10-11

- Changed: refresh the bundled canon pins for stylelint-canon 2.0.7 and cli 1.2.4; behaviour is unchanged.

## 8.2.4 - 2026-10-11

- Changed: refresh the bundled canon pins for @starci/grammar 0.9.3; lint rules are unchanged.

## 8.2.3 - 2026-10-11

- Changed: refresh the bundled canon pins for @starci/grammar 0.9.1; lint rules are unchanged.

## 8.2.2 - 2026-10-11

- Changed: refresh the bundled canon pins for the alpha.9.1 package bindings.

## 8.2.1 - 2026-10-10

- Changed: refresh the bundled canon pins for the queue-template package patch; lint rules are unchanged.

## 8.2.0 - 2026-10-09

- Changed: the bundled runtime copies (engine config, architecture machine, slot manifest, canon pins, failure codes) follow the runtime of 1.0.0-alpha.9; no rule is added or removed. Version 8.1.0 on the registry carries the copies of an earlier runtime.

## 8.1.0 - 2026-10-08

- New: the `sonar-parity` law (R235 `SCAN_SMELL`): `no-await-in-loop` (S9382), `prefer-code-point` (S7758), `prefer-string-raw` (S7780), `no-nested-conditional` (S3358), `no-void-operator` (S3735), `no-unused-import` (S1128), `prefer-export-from` (S7763) and `no-unused-prop-types` (S6767), each the syntax-tree form of the Sonar rule SonarCloud flagged in the example apps, shared with the back-end canon through the bundled `runtime/scripts/lib/sonar-syntax-rules.mjs`. The factory also turns on the typescript-eslint rules `no-deprecated` (S1874), `no-base-to-string` (S6551) and `require-await` (S7503); `@typescript-eslint/eslint-plugin` becomes a dependency of this package.
- Changed: `one-outcome-union` reads the Outcome home from the slot manifest (`outcomeHome` on `fe.transport.outcome`, `fe.package.api.outcome` and the lite `fe.modules.db.outcome`, i.e. `modules/db/outcome.ts`) instead of two slot ids in code; a lite app's db owner is its transport, so its `modules/db/outcome.ts` is THE union and a second one anywhere else is still refused. Full is unchanged.
- Changed: `public-component-signature` accepts a component with no parameter; `no-raw-structural-element` names `Region`, `NavLandmark`, `List` and `ListItem` as owners of section, nav, ul/ol and li; FE-I18N-1 and FE-TYPING-6 canon text (request locale through `next/root-params`, no `void props`); the FE_SWR_KEY_IDENTITY check reads `&&` and `||` gates in its bundled runtime.
## Unreleased (C0 batch)

- Changed (contract change `sonar-coverage-exclusions`): `route-slot-fixed-name` holds `error.tsx` to `ErrorBoundary`, no longer `Error`. `Error` shadows the global Error constructor (Sonar typescript:S2137, a bug), and React calls this component an error boundary. A slot still named `Error` is now reported.

## 8.0.7 - 2026-10-01

- Changed: the same bundled runtime layer move.

## 8.0.6 - 2026-10-01

- Changed: the runtime api layer move and the new pins.

## 8.0.5 - 2026-10-01

- Changed: bundled slots.yaml, sonar-gate.yaml and canon-pins.

## 8.0.4 - 2026-10-01

- Changed: the bundled runtime copy of knowledge/hfs/canon-pins.yaml pins @starci/test-world 1.0.3. No rule or command changed.

## 8.0.3 - 2026-10-01

- Changed: the bundled canon-pins copy pins @starci/stylelint-canon 2.0.2, @starci/eslint-canon-be 3.0.3 and @starci/hfs 4.0.3. No rule changed.

## 8.0.2 - 2026-10-01

- Changed: the bundled runtime copies (slots, canon-pins, failure codes, the architecture machine) put `.starcistacks` and `.sops.yaml` at the app root (`app.starcistacks`, `app.sops`; a side holding either is refused, `HFS_STACKS_IN_SIDE`) and pin @starci/hfs 4.0.2 and this canon at 8.0.2. No lint rule changed.

## 8.0.1 - 2026-10-01

- Changed: the bundled runtime copy of knowledge/hfs/canon-pins.yaml pins @starci/hfs 4.0.1 (the scaffold resolves a real lockfile) and this canon at 8.0.1. No rule changed.

## 8.0.0 - 2026-10-01

- Breaking: the app monorepo standard (hfs 4.0.0). `loadHfs(import.meta.url)` in `fe/eslint.config.mjs` finds the app-root `hfs.json` (kind `app`) one level up and gives every linted file the view of the fe side (paths relative to `fe/`); a standalone front-end `hfs.json` (`profile: fe`) is refused. The project graph (`project-graph` law) is built per side from the side folder. The config stays the managed one-liner.
- New (lane c0-orphan): `props-fields-readonly` (R110 `FE_PROPS_MUTABLE`, law props-and-slots). The props type of an exported rendering function in product source is readonly all the way down: every field and index signature is `readonly`, and every collection it holds, directly or in a nested object declared in the file, is `readonly T[]`, `readonly [A, B]` or `ReadonlyArray<T>`. Replaces the unrun readonly-props script adapter of the retired code-pattern folder.
- New (lane AUTHCHK): `response-cookie-attributes` (R107 `FE_COOKIE_ATTRIBUTES`, law client-boundary). A `set` on Next's `ResponseCookies` (`response.cookies.set`, `(await cookies()).set`), identified by the method's declaring class of `next`, must state `httpOnly` as a literal, carry `secure` and use `sameSite` `lax` or `strict`, judged on the TYPE of the options. The typed fixture's `next/server` and `next/headers` stubs gain the cookie classes.
- Fixed (false positives): `route-files-thin` counts a feature owner a route file mounts through the app alias `@/` (the project graph gives each file to the deepest tsconfig project that holds it, the app's own, whose paths define the alias). `alias-reexport` does not report a route file binding a declaration to a Next.js segment export (`export const generateMetadata = homeMetadata`): the framework fixes that name. Each former false positive is a valid RuleTester case.

## 7.1.2 - 2026-10-01

- Fixed: the bundled machine no longer crashes on a local export list (shared with eslint-canon-be 2.1.2).

## 7.1.2 - 2026-10-01

- Fixed: `duplicate-code` and every project-graph rule failed to load in a repository with a local export list (`export { x }`, no module specifier): the backend machine read `moduleSpecifier.kind` of an absent specifier. The packed-load spec now carries such an export.

## 7.1.1 - 2026-10-01

- Fixed: every rule failed to load in product repositories ("the managed package-scripts template ... cannot be found next to the runtime"): the bundled runtime now carries the data files the architecture machine reads beside its code (the managed package-scripts templates, canon-pins and the Sonar gate). A new runtime spec, `tests/canon-packed-load.spec.mjs`, installs each canon from its packed tarball into a real HFS repository and requires every rule to load.

## 7.1.0 - 2026-10-01

- New: the `project-graph` law: the TS-attached front-end architecture checks (routes, owners, paths) as eslint rules at error, from one cached project graph per lint run.

- Breaking (rule id): `no-http-status-collapse` is renamed `no-failure-collapse`. It fires on UI code that consumes an `Outcome` as well as on HTTP clients, so its name and messages now speak of a failure and its reason (branch on an `Outcome`'s reason code; map an HTTP status to an `Outcome` first). A branch that reads `reason` or `kind` counts as inspecting the failure. Update any `eslint-disable` naming the old id; there is no alias.

## 7.0.0 - 2026-09-30

- **New: `no-vietnamese-in-source` (R91).** Identifiers, string literals, template text, JSX text, comments and test titles carry no Vietnamese letter, specs included. Detection is structural on characters (`scripts/lib/language.mjs` in `runtime/`, folded to NFC, so NFD is caught too). The only exemption is the i18n fixtures slot `fe.e2e-support.i18n` (`e2e/fixtures/i18n/`). Removed: the second-language branches of `no-hardcoded-copy` (its `second` and `comment` messages) and the `SECOND_LANGUAGE_LETTER` export; the one rule holds the law.
- **Breaking: the front end has no tests, so the front-end test rules are gone.** Removed rules: `no-class-string-in-spec`,
  `spec-tests-its-neighbour`, `no-barrel-spec`, `no-double-cast-in-spec`, `connected-spec-has-axe`, `no-mocked-translations`
  (spec quality), `e2e-spec-location`, `e2e-no-absolute-path`, `e2e-no-docker`, `e2e-no-cross-repo-write`, `e2e-no-skip`,
  `e2e-typed-helpers`, `playwright-viewports` (e2e shape) and `unit-test-colocated`, with their why entries, docs and fixtures.
  The factory no longer builds an e2e block (`e2e/**`, `playwright.config.ts`) and returns the ignore block and the typed source block
  only; `sourceRecommended` and `e2eRecommended` are gone (`recommended` is the one set); the spec and e2e exemptions of the other
  rules (`isSpecFile`, `isE2eSource`, the `e2e` tier) are deleted. A test file, a test-tool file or a test dependency in a
  front-end repository is now refused by `hfs check` (FE_NO_TESTS, R97) instead.

## 6.0.2 - 2026-09-30

- **Fix: `use-client-only-at-boundary` refused the providers wrapper.** The route tree's `providers.tsx` (root or `[locale]`,
  role `providers` of `fe.route` in the slot manifest) is the client component a server layout renders around its children to host
  context providers; the directive is accepted there. A providers wrapper kept elsewhere (a layout feature, a module) is still a
  finding, and the message names `providers.tsx` as its home.

## 6.0.1 - 2026-09-30

- **Fix: `no-hand-rolled-polling` refused a shared clock.** A timer is polling only when what it runs reads data - a call whose
  value is a promise (`fetch`, the transport client, a reader, SWR's `mutate()`), an `await`, or a same-file function that does -
  decided by type, not by name. nivo-fe `useNow` (a one-minute tick behind `useSyncExternalStore`) and a state countdown pass; a
  timer that fetches or revalidates is still refused. The self-scheduling `setTimeout` check follows the enclosing function's
  binding, not its spelling. The FE convention names no shared clock owner, so no clock rule is added.

## 6.0.0 - 2026-09-30

- **Census fixes (starci-next-fe main, lane F0):** `one-outcome-union` treats a `kind` union as a result union only with an `ok`
  arm beside a failure kind (a mapper's view union - `LessonViewerView`, `StudyStepView` - is a screen state);
  `client-maps-auth-to-refused` accepts the Outcome constructor named by its kind (`failed("refused", ...)`) and a status branch
  inside a helper whose parameter every call fills with the response status;
  `i18n-stack-in-one-module` lets the proxy of a one-app repository build the locale middleware; `server-module-marks-server-only`
  requires the marker of server modules and of every server reader (role `reader`), not of components (reachability is
  FE_CLIENT_REACHES_SERVER's); `route-tree-holds-routes-only` admits next-intl's root `not-found.tsx` and its root `layout.tsx`.

- **Every law scopes by slot, never by folder regex (lane F0-H).** The path predicates of `class-names`, `props-and-slots`,
  `vendor-boundary`, `loading`, `type-safety`, `typography`, `brand-values`, `formatting`, `comments`, `hygiene`, `translation`,
  `lint-escape-hatch`, `client-boundary`, `file-layout`, `shape-slot`, `the-split`, `landmark`, `icon`, `served-locale`, `e2e-shape`,
  `hooks-folder`, `naming`, `next-conventions`, `tokens`, `size-and-state-budget`, `spec-quality` and `transport` ask the slot view
  (`kind`, `role`, tier, owner, `hfs.allows(file)`, `classifyImport`) instead of testing a path. Shared-package layers (`fe.package.ui`)
  are governed like app components; a file no slot owns is judged by `hfs check` (`HFS_SLOT_UNDECLARED`), not by a folder-name rule.
  Line and hook budgets (`component.tsx`, `index.tsx`, `file`, `useState`, `dataHooks`) are read from the slot manifest.
  `navigation-from-intl` exempts only the `proxy` and `global-error` roles; `no-middleware-file` reads slot `fe.source-root-retired`;
  `route-tree-holds-routes-only` reads the `allows` of `fe.route`; `no-unresolved-token-class` reads the app's route and brand stylesheets.

- New law `status-colors` (R61 `FE_STYLE_TOKEN_ONLY`): `status-text-uses-soft-foreground` refuses a class that paints text, an icon or a
  text decoration with a solid status tone (`text-success`, `fill-danger`, `stroke-warning`, `decoration-info`, with any variant, opacity or
  `!`), read from `className`/`class`, `cn()`/`clsx()` arguments, conditionals, arrays, constants and `classes` entries. The soft pair
  (`text-<tone>-soft-foreground`, `bg-<tone>-soft`), a solid fill with its own ink (`bg-<tone> text-<tone>-foreground`) and solid borders,
  rings and outlines pass. The tones come from `lib/status-tones.generated.mjs`, generated from the grammar by
  `packages/stylelint` (`npm run vocabulary`), never listed in the rule.

- **Breaking: `starciFeConfig({ hfs: loadHfs(import.meta.url) })` replaces `starciFeConfig({ layout })`.** The factory reads the
  repository's `hfs.json` and the shipped slot manifest (`runtime/`, refreshed by `packages/hfs/scripts/sync-runtime.mjs`), lints
  every app's and every workspace package's `src/` with typed linting (`parserOptions.projectService`) and the e2e tree
  syntax-only, ignores build output, `__generated__/` and `.starci/`, and puts the slot view in `settings.starci.hfs`
  (`lib/hfs.mjs` `hfsOf(context)`); `lib/types.mjs` holds the type-aware helpers. `LAYOUTS`/`LAYOUT_GLOBS` are deleted.
- **Breaking: the `lint-adoption` law and its `effective-config` audit are deleted**, with `audits`/`auditOwners`: the
  managed `eslint.config.mjs` one-liner that `hfs check` compares with its render (R17) is the one proof that no rule is off.
- `linterOptions` lives in `lib/config.mjs` only (the copy in `lint-escape-hatch.mjs` is gone).
- New peer dependency `typescript >=5.9`; `@typescript-eslint/parser` is a dependency. Tests build typed cases with
  `fixtures/typed/tester.mjs` (`typedTester`, `slotTester`, `at`).

- **Breaking: `no-direct-heroicon-import` is deleted.** It was a second name for a second copy of
  `no-vendor-icon-outside-icon-leaf` (icon law); one obligation has one rule (redundancy RED20). The copy in
  `vendor-boundary.mjs` is gone; `no-vendor-icon-outside-icon-leaf` is unchanged.
- New law `size-growth` (R20 `HFS_SIZE_GROWTH`): `file-size-growth` refuses a new source file over the line budget and an existing file over it that is longer than at the parent commit. The budget is `ruleParams.fe.fileLines` of the slot manifest, read through the slot view (`hfsOf(context).ruleParams`, the package's own `runtime/` copy) (`packages/hfs/scripts/sync-runtime.mjs` keeps it equal to the runtime's); the rule takes no option.
- **Breaking: `no-internal-starci-href` is deleted.** It was a second, weaker copy of `no-hardcoded-route` (which already refuses a
  route literal in any JSX `href` and any navigation call, specs excluded); one obligation has one rule. `no-hardcoded-route` gained a
  passing case for `mailto:` on `<a>` and a violating case for `<a href="/tasks">`. R93 no longer lists it.
- **Fix: `no-direct-const-alias` fired on `export const generateMetadata = x` in a Next route segment file.** The names Next reserves
  (`generateMetadata`, `metadata`, `viewport`, `dynamic`, ... in `lib/next.mjs`, the list of the architecture machine's
  `NEXT_RESERVED_EXPORTS`) are exempt when the file is a route segment file (slot `fe.route`, stem `page`/`layout`/`template`/...);
  a non-reserved alias in a route file and a reserved name elsewhere still fire. The rule now needs the slot view (`hfsOf`).
- **Fix: `no-barrel-spec` fired on every `index.spec.ts`.** It now reads and parses the sibling `index.ts(x)` and fires only when the
  sibling holds nothing but import and export declarations (a barrel); an `index.ts` with a function, class or value (starci-next-fe
  `modules/browser-storage`) may have its spec, and a missing sibling is no finding. It also covers `.tsx`.
- **Fix: `no-mocked-translations` refused a `next-intl/server` mock that serves the real catalogue.** A server helper has no provider to
  render inside; the mock is allowed when its factory (or a `vi.hoisted` block it reads) uses an import that resolves into the app's
  `modules/i18n/messages/`. Client `next-intl` mocks, literal/key-echoing server mocks and automocks still fire, now with a
  server-specific message (`mockedServer`) naming `createTranslator` over the real messages. The rule needs the slot view (`hfsOf`).
- **Fix: `no-hand-typed-wire` fired on `(await response.json()) as unknown`, the narrowing entry `no-type-assertion` allows.** It now
  fires only when a value read from `.json()` (directly or through a `const`) is asserted or annotated to a type that is not `unknown`
  and not imported from a `__generated__/` module (decided from the file's import declarations). **Breaking:** the `declared` branch
  (a name suffix `Wire|Dto|DTO|Response|Payload` on an interface or alias in `modules/api`) and the `graphqlType` branch (a name
  pattern `GraphQl*`) are deleted; detection by name is not a detection.
- Every rule is catalogued under an HFS rule id (R91 FE_SOURCE_FORM, R92 FE_COMPONENT_API, R93 FE_VENDOR_BOUNDARY added).
- **One client, one Outcome, one i18n stack, grammar components (lane F0-D).**
  - `lib/scope.mjs`: `isConfigModule`, `isApiClient` and the new `isOutcomeModule` are slot questions (`fe.modules.config`, `fe.transport.client` / `fe.package.api.client`, `fe.transport.outcome` / `fe.package.api.outcome`) taking the rule `context`, not path regexes; `PACKAGE_TIERS` is deleted (`use-client-only-at-boundary` asks slot `fe.package.ui` and reads the tier below the package root); `slotOfFile`, `inSlot` and `globalReferences` (scope-resolved globals) are new. Their rule tests run under `slotTester()`/`typedTester()` with `at("apps/web/src/...")` filenames.
  - `fetch-only-in-api-client` resolves the global `fetch` (and `globalThis.fetch`, `window.fetch`, `self.fetch`, aliases, destructuring), `new Request`, `new EventSource`, `navigator.sendBeacon` by scope, and fetch libraries (axios, ky, got, undici, ofetch, graphql-request, urql, `@apollo/*`, `@urql/*`) by module specifier; the one file allowed is slot `fe.transport.client` or `fe.package.api.client`. `client-fetch-has-signal` and `no-shared-transport-state` ask the same slots (the shared api package is covered).
  - `client-maps-auth-to-refused` judges a real branch: the fetch response's status (typed `Response`) compared with 401 and 403 whose consequent builds `kind: "refused"`; three literals anywhere no longer pass.
  - New `one-outcome-union` (R51): a union alias of object types sharing a literal `ok` or `kind` discriminant is declared only in the outcome slot.
  - New `i18n-stack-in-one-module` (R59): `defineRouting`, `createNavigation`, `getRequestConfig`, `createMiddleware` (by import specifier) are called only in slot `fe.package.i18n`, or `fe.modules.i18n` of a one-app repository. `no-second-i18n-stack` stays: it refuses another i18n library, a different obligation.
  - New `no-raw-structural-element` (`grammar-boundary`, R62): raw `h1-h6 p span hr label form fieldset dl dt dd table..th ul ol li header footer nav section main figure figcaption` in app slots and non-`ui` packages; `div br aside article` have no grammar component and stay allowed.

- **Breaking: the timer rule is now `effect-subscription-needs-cleanup`** (`FE_EFFECT_CLEANUP`, no alias). Inside a React `useEffect` / `useLayoutEffect` callback (resolved through the import) and inside a `useSyncExternalStore` subscribe (also when passed by name), every `setTimeout` / `setInterval` handle, `requestAnimationFrame` id, `addEventListener` (target, type, listener), `.observe`d `ResizeObserver` / `IntersectionObserver` / `MutationObserver`, `WebSocket` / `EventSource` / `BroadcastChannel` and subscription object (`unsubscribe` / `off` / `close` in its type) must be released by the returned cleanup against the SAME handle (scope binding or member path), not by any `clearTimeout` in it. The `/modules/` exemption is gone: outside an effect a timer or frame is accepted only when the function that starts it releases it (the 5.1.2 returned-closure acceptance and the API client's `finally` both hold structurally). Typed linting is required.
- **`no-data-fetch-in-effect` sees indirect loads.** A call executed synchronously in the effect body whose value is a promise (`void load()` with `load` async anywhere, an SWR `mutate()` / `refresh()`), is `.then`-ed, or is `void`-ed and untyped is a finding; a promise started inside a listener or timer callback the effect registers is not. The effect is React's export, resolved through the import.
- **New rule `server-module-marks-server-only`** (R55, new code `FE_SERVER_ONLY_MARK`): a module that imports `next/headers`, `next/server`, `next-intl/server`, a Node built-in, or a module that resolves to a file starting with `import "server-only"` must itself start with `import "server-only"`. Route files (slots `fe.route`, `fe.source-root-pinned`) are exempt. `client-no-server-import` also refuses `next-intl/server` and `next/server`.
- **`no-hardcoded-copy` (R58)** reads template literals with substitutions whose static parts hold a word (`${count} installed`) in JSX children and copy attributes, and any object property whose value is a whole sentence under any key (`{ ready: "Your course is ready" }`); class names, URLs, ids, keys, units and format tokens still pass.
- **`no-inline-lint-config` (R18)** also refuses `NOSONAR`, `@sonar-ignore`, `istanbul ignore`, `c8 ignore`, `v8 ignore`, `prettier-ignore` and `stylelint-disable` comments.
- New `lib/bindings.mjs` (scope bindings, imports, stable keys), `lib/platform.mjs` (platform symbols) and `lib/react.mjs` (React exports by import).

## 5.1.2 - 2026-09-30


## 5.1.1 - 2026-09-30

- **Fix: `use-client-only-at-boundary` knew only the app layout.** A workspace package keeps its grammar tiers directly under `src/` (`packages/<pkg>/src/{composites,branches,leaves}`, the `fe.package.ui` slot), but the rule accepted the directive only under `/components/...`, so nivo-fe's `packages/nivo-ui` reported 13 false findings. The tier names come from `PACKAGE_TIERS` in `lib/scope.mjs` (the slot's layers, no repo name); a package branch or leaf is a boundary, a package composite is not, and the app layout is unchanged.
- **Fix: the `monorepo` layout scanned only `packages/ui`.** `LAYOUT_GLOBS.monorepo` named the shared package literally (`packages/ui/src/**`), so a workspace package with any other name (nivo-fe's `packages/nivo-ui`) was governed by no starci-fe rule and a deliberate bare `<img>` there printed nothing. The source glob is now `packages/*/src/**/*.{ts,tsx}` and the e2e glob adds `packages/*/e2e/**/*.{ts,tsx}`; every package is judged by the same rules.

## 5.1.0 - 2026-09-29

Round 2 of the FE enforcers, measured on nivo-fe, starci-next-fe and miamia-fe. Twenty-two rules, every one an error; no rule of 5.0.0 changed. Each is registered in `knowledge/hfs/rules.yaml` under the catalogue rule it enforces, with a Vietnamese failure code.

- **Type safety (R22, `FE_TYPE_ESCAPE`)**: `no-type-assertion` (`as T`, `<T>x`; `as const` and `as unknown` stay), `no-non-null-assertion`, `no-explicit-any`. `no-double-cast` now has a why entry.
- **Lists (R65, `FE_LIST_KEY`)**, new law `lists`: `list-item-has-key`, `no-index-key`, `no-inline-literal-prop-in-list`.
- **Runtime hygiene (R65, R50)**, new law `hygiene`: `effect-subscription-needs-cleanup` (`FE_EFFECT_CLEANUP`), `no-data-fetch-in-effect` (`FE_EFFECT_FETCH`), `no-empty-catch` (`FE_SWALLOWED_ERROR`), `no-console` (`FE_CONSOLE_CALL`).
- **Formatting (R59, `FE_I18N_FORMATTER`)**, new law `formatting`: `use-intl-formatter` (`toLocale*String`, `new Intl.*Format`, displayed `toFixed`, currency glued to a template, date libraries).
- **Next conventions**: `page-exports-metadata` (R54, `FE_PAGE_METADATA_MISSING`), `no-null-suspense-fallback` (R53, `FE_SUSPENSE_NULL_FALLBACK`), `navigation-from-intl` and `no-native-anchor` (R59, `FE_I18N_NAVIGATION`), `no-hardcoded-route` (R57, `FE_ROUTE_HARDCODED`).
- **Client boundary (R55)**: `client-no-server-import` (`FE_CLIENT_SERVER_IMPORT`), `web-storage-only-in-modules` (`FE_STORAGE_OUTSIDE_MODULES`), `no-dangerous-html` (`FE_DANGEROUS_HTML`).
- **Native controls (R62, `FE_NATIVE_IMAGE`)**: `no-native-img`, `image-has-size`.
- **Transport (R51, `FE_OUTCOME_KIND_UNHANDLED`)**: `outcome-kinds-exhaustive`.
- `lib/ast.mjs` holds the JSX attribute, call-name and effect-callback readers the new laws share. One doc page per new law; type-safety gained its page.

## 5.0.0 - 2026-09-29

HFS Phase 0 item 0.6. Breaking: the factory signature, the retired rules and the level of every rule.

- **`starciFeConfig({ layout })`** returns two flat-config blocks (source and e2e) and owns the law: every published rule at `error` (the factory throws if one is not), the React Hooks rules (`eslint-plugin-react-hooks` 7, recommended set lifted to `error`, `set-state-in-effect` and `refs` required), and `linterOptions` (`noInlineConfig` plus `reportUnusedDisableDirectives: "error"`). The `plugin`, `recommended` and `linterOptions` inputs are gone. `eslint-plugin-react-hooks >=7` is a new peer dependency.
- **`vn-ok` is removed entirely.** `no-second-language-in-source` and `no-hardcoded-copy-in-vocabulary` are replaced by `no-hardcoded-copy` (R58): no literal copy at any tier, in any language, no pragma, no endonym or `resources/` exemption. Same notion of literal as nivo-fe's `check-i18n-catalog.mjs` (a word is two or more letters). A `vn-ok:` comment is now itself a finding of `no-inline-lint-config`, which also refuses `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `eslint-env` and inline `eslint rule:` config, and now covers specs and the e2e tree.
- New laws and rules: `env-owner` (R49: `no-env-outside-config`, `no-hardcoded-endpoint-fallback`), `transport` (R50-R52: `fetch-only-in-api-client`, `client-fetch-has-signal`, `no-shared-transport-state`, `client-maps-auth-to-refused`, `no-http-status-collapse`, `no-hand-typed-wire`), `client-boundary` (R55: `use-client-only-at-boundary`), `hooks-folder` (R56 lint half: `hooks-folder-holds-hooks-only`), `next-conventions` (`no-middleware-file`, `locale-segment-is-locale`, `no-second-i18n-stack`, `html-lang-from-locale`), `brand-values` (R61 TypeScript half: `no-raw-brand-value`), `native-controls` (R62: `no-native-form-control`), `size-and-state-budget` (R65: `component-line-budget`, `unit-hook-budget`, `no-hand-rolled-polling`), `e2e-shape` (R66, seven rules on `e2e/**` and `playwright.config.*`), `spec-quality` (R67 and the real-catalogue half of R60: six rules).
- `sourceRecommended` and `e2eRecommended` are exported beside `recommended` (their union); the effective-config audit compares a production probe against `sourceRecommended`.
- `why[rule]` is `{ code, vi, fixVi }`: the catalogue finding code and the Vietnamese why for every rule of the catalogued laws.
- One doc page per law under `docs/`.
