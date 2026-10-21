# Changelog

## 4.7.17 - 2026-10-21
- Fixed: the sonar row of `starci app release gate --sonar` no longer passes on the scanner's exit code alone: it reads `.scannerwork/report-task.txt`, polls `api/ce/task` until the analysis ends and reads `api/qualitygates/project_status` with the same token; ERROR is red as `RELEASE_SONAR_GATE_FAILED` naming each failed condition, a 600-second wait is `RELEASE_SONAR_GATE_TIMEOUT` and an unreadable answer `RELEASE_SONAR_GATE_UNREADABLE`; canon pins follow the matching package cohort.

## 4.7.16 - 2026-10-21
- Fixed: `DB_MIGRATION_DESTRUCTIVE` counts a be/src source as a reference of a dropped or altered column only when the source names the column's table too, so a same-named column of another table (`public.brain_lessons.origin` beside a drop of `transactions.origin`) no longer blocks a contract migration; table and other object drops keep the leaf match; canon pins follow the matching package cohort.

## 4.7.15 - 2026-10-21
- Added: slot `be.contract.mcp-tools` (opt-in, slot manifest 3.4.0) for the committed MCP tool catalog `be/contracts/<app>/<contract>.tools.json`, and R302 `HFS_MCP_TOOLS_SNAPSHOT`: the catalog names a declared be app, its contract is `<server>@<major>` equal to the file name and the server name, and every tool has a unique name, a description and an object `inputSchema`; canon pins follow the matching package cohort.

## 4.7.14 - 2026-10-20
- Added: `starci app hygiene` (the managed pre-commit hook) refuses a back-end logic file the index adds without its `<name>.<role>.spec.ts` beside it, naming the file (`BE_UNIT_SPEC_NOT_STAGED`, R47); the measured roles and roots come from the coverage scope.
- Added: `starci app check` reports `HFS_HOOKS_NOT_INSTALLED` (R13, error) when a set `core.hooksPath` names a hooks folder that is missing or holds no husky dispatcher in the checkout, with the install remedy.
- Fixed: R165 `HFS_SERVICE_STACK_DECLARATION` accepts, for an api or worker app, a `role: service` component named after it or mapped to it by `environments.<env>.deploy.images.<component>.app` in any environment, so a deployed service named after its stack (`shop-api: {app: api}`) needs no rename onto a shared network alias.
- Changed: the scaffold's next step names `starci npm ci`, which installs the lockfile and then the app's git hooks; canon pins follow the matching package cohort.

## 4.7.13 - 2026-10-20
- Fixed: the lite CI template sets NODE_OPTIONS on the database migration check step; ci-standard heap.steps lists `npm run db:lint`.
- Fixed: bundled runtime source clears the SonarCloud code smells of alpha.23 (regex complexity, concise classes, string prefix and suffix checks, block braces, optional chaining, export-from, default parameters, synchronous awaits, dead stores) without behavior change; canon pins follow the matching package cohort.
- Fixed: `starci app release gate --sonar` produces `reports/lint.sonar.json` before the scanner (per-side `starci app lint --sonar` runs merged like the managed CI), so the scanner no longer fails on the missing external issues report; a failing lint fails the sonar row.

## 4.7.12 - 2026-10-19
- Fixed: bundled source analysis uses explicit nullable contracts, unary callback arguments and grouped regular-expression alternatives while preserving refusal paths; canon pins follow the matching package cohort.

## 4.7.11 - 2026-10-19
- Changed: app release and Sonar adapters use native target binding, with local database migration and Docker transport preserving the declared stack target.

## 4.7.10 - 2026-10-19
- Changed: bundled canon pins follow the regenerated Stylelint vocabulary and the matching lint canon cohort; HFS command behavior is unchanged.

## 4.7.9 - 2026-10-19
- Changed: the lite scaffold README explicitly starts the Docker engine before the Supabase CLI-managed local stack and keeps application startup in its declared development profile.

## 4.7.8 - 2026-10-19
- Fixed: catalog usage follows ordered object and JSX spreads, readonly class translator fields and their declared forwarding methods while unknown or overwritten producers remain barriers.
- Fixed: strict-null narrowing retains initializer provenance only for an unmodified const reference; destructuring writes and ancestor replacements invalidate the proof across the containing evaluation frame.
- Fixed: finite template catalog keys resolve from bounded tuple and callback values, with unknown spans and excessive products rejected; a proven catalog leaf consumes only its same-bundle locale siblings.

## 4.7.7 - 2026-10-19
- Changed: bundled canon pins follow the front-end canon's module classification correction in 8.4.13; HFS command behavior is unchanged.

## 4.7.5 - 2026-10-18
- Fixed: Codecov ignores the same slot-derived coverage complement as Sonar, including imported config, module and persistence files in shard reports. Project, patch and component targets remain at 100% on every measured logic file.

## 4.7.4 - 2026-10-18
- Fixed: the managed Sonar configuration uses `sonar.javascript.node.maxspace`, the analyzer's supported Node heap property, with the existing 6144 MiB CI Node budget. This leaves memory for Java and the OS on an 8 GB runner; `sonar.nodejs.maxspace` did not apply the configured limit.

## 4.7.3 - 2026-10-18
- Fixed: the managed CI typecheck step declares the CI standard's raised Node heap, preventing the NIVO release candidate's typecheck from exhausting Node's default heap; the CI standard checks typecheck steps too.
- Fixed: the fresh coverage job runs codegen before the whole-app coverage proof, preparing ignored GraphQL wire types before the app check or its isolated example copy starts; a failed generator stops the proof.

## 4.7.2 - 2026-10-18
- Fixed: `app coverage merge` merges the shard istanbul maps through the installed @starci/jest-preset/merge (4.7.1 merged lcov text and reported phantom gaps on real data); the managed unit step sets STARCI_COVERAGE_SHARD and uploads coverage-final.json; `app lint` accepts a canon inside the app's linked node_modules.

## 4.7.1 - 2026-10-18
- Fixed: the package files list carries coverage/ (4.7.0 shipped `app coverage merge` without coverage/cli.mjs); the lint upload condition of the managed CI names the per-side report with format() instead of a nested ${{ }} that actionlint reads as always true.

## 4.7.0 - 2026-10-18
- Added: `app release push --execute` pushes the release sha to `release/candidate-<version>` and moves the branch and the tag only when its ci.yml run is green (RELEASE_CANDIDATE_CI_RED / _TIMEOUT, RELEASE_CI_UNKNOWN; the owner's sha-bound override record is the emergency path); the managed ci.yml and pre-push hook carry the candidate ref; R301 CI_STANDARD in the app check.
- Added: the managed CI shards the unit run (`ci.jobs.test.shards`, default 6), lints each side in its own job and merges coverage in a coverage job (`starci app coverage merge`); `ci.jobs.<job>.timeoutMinutes`; jest/build caches keyed by the lockfile and saved always; `starci app ci local` runs the rendered jobs locally in parallel.
- Fixed: a scaffolded app root overrides `@graphql-tools/utils` to the canon pin 12.1.0, closing GHSA-7mx3-vvmw-hjmv (npm audit high) under @nestjs/graphql 13.x.
- Changed: `app release gate` no longer reads the default-branch CI (release/ci-red.mjs removed); the app trigger check allows the candidate branches.

## 4.6.0 - 2026-10-18
- Added: `services.codecov|sonar.badgeToken` README badge tokens and `ci.github.visibility` with a private-repository notice (sync, ci verify); `ci.vars` `ownerValue: true` (var sync skips, var set reads stdin, verify checks the name).
- Fixed: the app release gate counts tag-push CI runs reachable from origin/main, main or HEAD; the secret scans exempt only declared badge tokens.
- Fixed: empty placeholder lines vanish so every managed file is prettier-stable; CI coverage proof heap, per-side Sonar lint reports merged for the import, per-fe-app build env; `app lint --side` combines with `--sonar`.

## 4.5.1 - 2026-10-18
- Fixed: managed CI base refs, public build values, caching and timeouts; optional quality service handling, README formatting and Supabase migration-history parsing.

## 4.5.0 - 2026-10-17
- Added: consumer-class CI declarations, `app ci` custody verbs and R296-R298; manifest-driven quality files and split cached CI with immutable action pins.
- Added: release audit/local Sonar and main-CI protection; encrypted outside-repository DB dump and armed linked reset with backup/auth/storage validation.
- Fixed: DB types refuse stale migration history.

## 4.4.1 - 2026-10-17
- Changed: the bundled runtime copies follow the runtime of 1.0.0-alpha.19 (owner ruling no-runtime-specs, 2026-10-17): the failure codes, the slot manifest (`exampleNa`) and the rule catalog (`specNa`, `exampleNa`) carry the removal of the runtime's own specs; package behavior is unchanged. The managed codecov.yml, the CI coverage upload and the hfs sync render stay (Codecov is kept for apps and examples); internal exports that only the deleted runtime specs read are no longer exported.

## 4.4.0 - 2026-10-15
- Fixed: a swarm service on a shared external edge network no longer keeps the implicit short service name as an alias (`docker stack deploy` adds `api` for nivo_api on every network, so another tenant resolving `http://api` reached the wrong stack). `starci app stack deploy` and rollback reconcile the edge attachment to exactly the declared aliases right after `docker stack deploy` (`STACK_DEPLOY_EDGE_ALIAS` when they still differ), `stack verify` refuses an undeclared alias on an edge-attached service, and the deploy preflight and `stack doctor` extend `STACK_DEPLOY_ALIAS_SHARED` to a short name that another container or service of the edge network already resolves (`STACK_DEPLOY_EDGE_UNREADABLE` when the network cannot be inspected).
- Added: R295 `BE_MODULE_DEFINITION_MISSING`: every Nest module has a module definition (owner ruling 2026-10-15 `owner:module-definition-everywhere`). The slot manifest allows `<x>.module-definition.ts` and `<x>.options.ts` beside every feature, transport, cli group, queue, reactor and job module; the generators of `starci app add` and `starci app new` write the three files and register the module as `X.register({})`.
- Changed: `module-per-transport` accepts a module-definition beside the application module, the transport module of its folder and a cli group, and refuses one anywhere else.

## 4.3.0 - 2026-10-14
- Added: the app file role `<app>.env.ts` (`apps/<app>/src/`, every `be.app.*` slot, budget 150): a typed `<App>Env` interface and fail-fast `read<App>Env` reader (secrets `_FILE` first), imported by `main.ts` so the entry stays within its 80 lines. Only `main.ts` and the app's own env file read the environment; the env file lists no module and imports no feature. The api, lite api and cli scaffolds write it.
- Added: `starci app secret` custody verbs `init`, `set <env> <slug> <KEY>` (stdin or `--generate <bytes>`), `get <env> <slug> [KEY] --to-file [--reveal]`, `materialize <env>` and `list <env>` over sops dotenv files under `.starcistacks/<env>/secrets/`; the age identity lives outside the repository, materialized values go under the local StarCi secrets directory for `*_FILE` reading, and no value reaches stdout unless `--reveal`. The scaffolded `.sops.yaml` carries the `init` instruction and the be config template reads `<NAME>_FILE` before `<NAME>`. An untracked root `secrets.env` of a lite app is an `HFS_PLAINTEXT_SECRET` warning.
- Added: lite delivery slots `app.deploy` (`deploy/`), `app.ci-deploy`, `app.ci-authorize-deploy-key` and `app.scripts.delivery`; R06 scans all of them.
- Added: fe tier edge `feature -> feature` narrowed by `mayImportKinds` (pages compose overlays and blocks) and render props in the pure half (`render*` callbacks in `props` of a non-block component); `FE_CONNECTED_BLOCK_RENDER_PAIR` reads the exact sibling `XBase` twin.
- Changed: a lite app's `.starciwork/` holds only `.gitignore`, `workspace.yaml` and `brand/**` and is optional (index.yaml, shell, features, resources, UAT and br are forbidden); the work readers (validate, kernel, uat, example refs) skip the removed workspace, index, shell and feature records under lite, and the lite scaffold and example no longer write them.
- Changed: a pure re-export `index.ts` gets the 400-line `barrel` budget (hooks slots); an `fe.modules` instance with no `.ts`/`.tsx` file needs no `index.ts` (`HFS_REQUIRED_FILE_MISSING`, `HFS_SLOT_REQUIRED_MISSING`).
- Changed: `BE_BACKGROUND_UNOWNED` decides by context (job processor, scheduler, saga, event handler and what they call), never by a `retry*`/`replay*` method name; resolvers and controllers are never background.
- Changed: `HFS_DUPLICATE_CODE` drops canon scaffold shapes; `HFS_UNUSED_EXPORT` counts staged test consumers; `FE_I18N_KEYS` reads in-segment template keys (`t(`stage_${x}`)`) as globs.
- Changed: the scaffolded pre-commit hook passes staged files to eslint and prettier in chunks of 50 (Windows command-line limit); `DB_MIGRATION_SHAPE` orders a new migration against HEAD's active migrations, not the clock or the base branch.


- Added: HFS manifest 3.1.0 (rule catalog 3.1.0, owner ruling 2026-10-14, R245 and R246): every `be.app.*` slot allows the composition groups `compose/<area>.ts` and budgets its composition files (`app.module.ts` 250, `<app>.options.ts` 200, `compose/<area>.ts` 120, `main.ts` 80); `<app>.options.ts` holds env-derived options and port bindings only (`BE_APP_OPTIONS_COMPOSITION`, `BE_APP_COMPOSITION_BUDGET`).
- Changed: `starci app scaffold` writes `apps/<api app>/src/compose/platform.ts` (the platform capabilities as one group, `platformModules(options)`) in both editions, and the scaffolded `app.module.ts` spreads it before the domain modules and the guards.
- Changed: `add table` lists the table's error kinds where the app keeps its error kinds array: the root `app.module.ts`, or else the `compose/` group that holds it.
- Changed: the architecture machine reads an app's root and its `compose/` groups as one composition (register-once, module-per-transport, the connection and context maps).

## 4.2.17 - 2026-10-14

- Fixed: the webhook door spec template signs with a per-run key (`randomBytes`) instead of a literal, so a scaffolded spec holds no plaintext secret-shaped value the release secret scan could flag.

## 4.2.16 - 2026-10-14

- Fixed: the `add api`, `add table` and `add webhook` templates render code the published canons (eslint-canon-be 3.2.17, eslint-canon-fe 8.2.16) accept, as examples/lite-app shows. The GraphQL error formatter spec builds its malformed-operation error from a code (`GRAPHQL_VALIDATION_FAILED`), not prose (`user-copy-through-catalog`); `platform/graphql`'s context factory types its parameter with the named `GraphqlContext` (`no-inline-param-type`); both webhook door spec templates register `HttpSecurityModule` with the module's own default and override `WebhookSignatureService` with the real verifier over a fake clock instead of a global `ClockModule` (`is-global-only-in-app`).
- Fixed: two tables no longer render duplicate code (`HFS_DUPLICATE_CODE`). The table service template answers `Pick<Row, "id">` through a named result type, throws its not-found error from one module-level factory handed to `requireOwnedRow` (whose factory now receives the id) and maps the insert's rows with a module-level `createdRow`.
- Fixed: `add table --fe` renders no dead or aliased operation types (`HFS_UNUSED_EXPORT`, `HFS_ALIAS_REEXPORT`): the operation files type their request with the generated variables, the types files export only the answer, which the SWR hooks name. `useQuery<X>Swr` answers the operation's GraphQLResponse as its data (as the ecommerce example does) and `useMutateCreate<X>Swr` primes that query with the response.

## 4.2.15 - 2026-10-13

- Changed: the heroicons family is the one application icon set (owner ruling 2026-10-13): the scaffold installs `@heroicons/react` 2.2.0 and `@starci/heroicons` 0.3.3 (fe-stack `icons`, tier core) in every product fe app in place of `@phosphor-icons/react`, and the `modules/toast` skeleton draws its status indicators with `@heroicons/react/24/outline` (CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, InformationCircleIcon). Carry the canon pins of eslint-canon-be 3.2.17, eslint-canon-fe 8.2.16 and CLI 1.2.15.

## 4.2.14 - 2026-10-13

- Breaking: HFS manifest 3.0.0 (schema `starci/hfs-slots@3`, rule catalog `starci/hfs-rules@3` 3.0.0). Removing the front-end database slots and the Supabase realtime feature slot and narrowing `fe.route` change answers for existing apps, so the manifest takes a major: every app pins `"hfs": 3` (scaffold writes it), and an app still pinned to 2 is refused with `HFS_MANIFEST_MAJOR_MISMATCH`.
- Changed: HFS manifest 3.0.0 re-rules the lite edition (owner ruling 2026-10-12, R212): lite is the full architecture deployed without self-hosted infrastructure. Lite regains the worker app, queue, event bus, saga, reactors, fenced jobs, projections, realtime and event contracts through their Supabase adapters, and full's unit world; only the e2e and contract layers, the browser journey, UAT records, the socket and graphql-ws doors and the self-hosted stack stay forbidden. The lite-only `be.feature.realtime.supabase` door is added and `repo.tests-forbidden` is removed.
- Changed: lite sync, scaffold and `add` render full's unit run (test scripts, jest config, the tests tsconfig, coverage and the CI unit step with the Codecov upload) and the lite unit specs; the lite identity module owns its access-token verifier token.
- Changed: carry the canon pins for Grammar 0.9.14, the BE/FE lint canons 3.2.15/8.2.15, jest-preset 2.2.7 and CLI 1.2.14.
- Changed: one front-end skeleton for lite and full (owner ruling 2026-10-13, knowledge/hfs/fe-stack.yaml). Every product Next app (full `app`, lite `web`; not the marketing `landing`) is scaffolded with the shared app core `templates/fe/skeleton/apps/__app__`: `modules/api/graphql` (the GraphQLResponse union), `modules/toast`, `modules/auth` (one `AuthClient` interface: a full IdP stub, the lite overlay a browser Supabase Auth client with client-side PKCE), `redux/` (store, typed hooks, ReduxProvider, the session slice), `components/providers` (one AppProviders owner composing the theme, redux, SWR config, app effects and the HeroUI toast region), `components/blocks` (SignInForm, SignOutButton, drawn by the home page), `hooks/auth` (session, sign-in, sign-out with its toast), `hooks/swr` (SwrSideEffects) and `hooks/effects` (the session kept in redux by the auth change subscription, no load in an effect). A fresh scaffold is lint-clean in both editions: it holds no code nothing calls, so the Apollo clients and their links arrive with the first GraphQL operation. The lite web app loses `modules/db`, its Server Actions, the `auth/callback` route and the session-refreshing proxy; health/live is its one route handler, and Supabase's redirect URL is the site root.
- Changed: the scaffold installs every `tier: core` package of fe-stack.yaml at its canon pin in both editions, read from the catalog (product app workspaces take the runtime packages, the app root the codegen, lint and compiler tools), and both editions add the back end's GraphQL stack (@nestjs/graphql, @nestjs/apollo, @apollo/server, graphql).
- Added: `npm run codegen:graphql`, and `scripts/codegen.mjs` in both editions generates each product app's `modules/api/graphql/__generated__` from `be/contracts/<app>/schema.graphql` with the GraphQL codegen client preset; both editions now run `codegen` before dev, build, typecheck and lint.
- Changed: the GraphQL door is the same in both editions. The shared be skeleton's `requestOf` reads a resolver's request through the GraphQL context and the errors filter hands GraphQL failures to the formatter; the GraphQL server capability (`modules/platform/graphql`: Apollo driver, error formatter, depth limit, localize plugin over `x-locale`) is written by the first GraphQL feature. Lite `add api` now writes full's GraphQL transport (principal-aware command and handler) and wires it with the server into the api app; the lite HTTP-door templates are removed.
- Changed: `add table --fe` emits the table's api feature over GraphQL (get and create, with the app_be insert policy and grant) and per product app the query/mutation operation files and the useQuery*Swr / useMutate*Swr hooks with their barrels, never Server Actions or Supabase readers; the first operation of an app also writes its GraphQL transport (`templates/fe/transport/graphql/clients`: the auth and no-auth Apollo clients with the retry, error, timeout, UNAUTHENTICATED refresh, locale, access-token and http links) and the `graphqlUrl` reader of its modules/config, as platform/graphql is written by the first GraphQL feature on the back end. `add app` is no longer refused in lite and renders partials and the shared core in both editions.
- Fixed: `starci app scaffold --edition lite` loads the installed jest preset's Sonar exclusions like full, so a fresh lite app's sonar-project.properties is the render its own `starci app lint` expects.
- Fixed: the full api `graphql.module.ts.tpl` imported a `<Feature>Module` the feature module never exported; it imports `<Feature>ApiModule`.

## 4.2.13 - 2026-10-12

- Added: HFS manifest 2.2.0 owns app compiler declarations under the declaration-only types/ambient slot, without a runtime entry; runtime source files remain refused there.
- Fixed: the derived Grammar contract selects all three required peers, react, @heroui/react and @xyflow/react. Full and lite FE scaffolds and the shared UI workspace declare @xyflow/react at the canonical 12.11.6 pin.
- Fixed: full and lite Next app scaffolds and the four Next app examples declare CSS imports through global declarations in their ambient owner, while missing non-CSS side-effect imports remain errors under TypeScript 6.
- Changed: carry the merged runtime mirror and canon pins for Grammar 0.9.13 and Stylelint canon 2.0.9, retaining the no-frontend-tests policy.

## 4.2.12 - 2026-10-12

- Changed: bundled canon pins carry @starci/grammar 0.9.12 (the secondary tab track keeps its padding).

## 4.2.11 - 2026-10-12

- Changed: bundled canon pins carry @starci/grammar 0.9.11 (secondary Tabs are HeroUI's own pill tabs).

## 4.2.10 - 2026-10-12

- Changed: bundled canon pins carry @starci/grammar 0.9.10 (the grammar ships without spec suites).

## 4.2.9 - 2026-10-12

- Changed: refresh the bundled canon pins for CLI 1.2.9 and the BE/FE lint canons 3.2.10/8.2.10 after correcting the CLI runtime install pin; app command implementations are unchanged.

## 4.2.8 - 2026-10-12

- Changed: refresh the bundled runtime and canon pins for grammar 0.9.9, the BE/FE lint canons 3.2.9/8.2.9, stylelint-canon 2.0.8 and CLI 1.2.8; app command implementations are unchanged.

## 4.2.7 - 2026-10-12

- Changed: refresh the bundled canon pins for grammar 0.9.8; behaviour is unchanged.

## 4.2.6 - 2026-10-12

- Changed: refresh the bundled canon pins for grammar 0.9.7 and heroicons 0.3.3; behaviour is unchanged.

## 4.2.5 - 2026-10-11

- Changed: refresh the bundled canon pins for CLI 1.2.5 and HFS 4.2.5; command and lint behavior is unchanged.

## 4.2.4 - 2026-10-11

- Changed: refresh the bundled canon pins for stylelint-canon 2.0.7 and cli 1.2.4; behaviour is unchanged.

## 4.2.3 - 2026-10-11

- Changed: refresh the bundled canon pins for @starci/grammar 0.9.3 and the canon packages; behaviour is unchanged.

## 4.2.2 - 2026-10-11

- Changed: refresh the bundled canon pins for the alpha.9.1 CLI and lint packages.

## 4.2.1 - 2026-10-10

- Fixed: queue templates preserve the declared Redis database for both Queue and Worker connections, with a nonzero-database adapter regression.

## 4.2.0 - 2026-10-09

- Changed: the lint runner (`lint/run.mjs`) and the bundled runtime copies follow the runtime of 1.0.0-alpha.9. Version 4.1.0 on the registry carries the copies of an earlier runtime.

## 4.1.0 - 2026-10-08

- Breaking (runtime alpha.4 CLI unification): remove the `hfs` bin and expose `main(argv, io)` for the sole `starci app ...` grammar; the app flags `--repo` and `--root` are replaced by the global `--cwd` flag.
- Changed (contract change `coverage-modules-logic`): the coverage scope is derived once from the slot manifest (`coverage: required|none` on every tracked be slot, `ruleParams.be.logicRoles`; `scripts/hfs/coverage-scope.mjs`). `hfs sync` renders it into `be/jest.config.js` (`starciJestConfig({ coverage })`), `sonar.coverage.exclusions` and `codecov.yml` (the measured roots, plus one Codecov component per service app and one `platform`, each at 100); `coverageScope`, `coverageExclusions` and `HFS_SYNC_COVERAGE_SCOPE` are gone. New R204 `HFS_COVERAGE_SCOPE_DRIFT`: a hand edit of any of the three coverage statements is drift. `hfs scaffold app` renders with the source it just wrote.
- Added (contract change `lite-edition`): the lite edition. `hfs.json` `edition: lite` (and an optional `supabase` block); `hfs scaffold app <name> --edition lite` writes the lite shape and generates `supabase/types/database.types.ts` by starting the app's own local Supabase stack (`HFS_SCAFFOLD_TYPES_FAILED` removes the app when it cannot); `hfs upgrade --edition full [--plan]` (additions only, new `upgrade/**` in the package files) and `hfs check --edition full`; `hfs add table <name> [--fe] [--no-types]`, `hfs add app <name>` and the lite bootstrap of `hfs add cli`; `add` and `new` refuse the nouns lite lacks (`<verb> <noun>: full edition only`); `hfs emit-contracts` also writes the Supabase types; `hfs check` runs the database rules (R213 to R216) and the lite rules (R212, R217 to R220) with the bundled runtime. New dependencies `libpg-query` and `smol-toml`.
- Added: lite-edition `hfs sync` renders its managed scripts, hooks, CI/database workflows, image matrix and Sonar configuration from edition-aware slot templates, without Jest, tests, Codecov or coverage conditions; full renders remain byte-identical.
- Added (contract change `patterns-hfs-add`): `hfs add <job|reactor|queue|projection> <name>` generates exactly one kind's file tree from the `files:` tree of its pattern topic (knowledge/patterns/be/<topic>.yaml, carried by the bundled runtime) with the one template body of each entry (templates/be/patterns), adds the platform capabilities the kind needs when they are missing, and registers the patterns and the trigger kind in hfs.json (`sides.be.patterns`, `sides.be.kinds`). `hfs.json` gains `sides.be.kinds`, required for every trigger kind in use (rules BE_KIND_DECLARATION, BE_KIND_EMPTY).
- New (microservice policy, R163 to R167): `hfs check` judges a product with more than one service: `HFS_SERVICE_PLACEMENT`, `HFS_IMAGE_UNPINNED`, `HFS_SERVICE_STACK_DECLARATION`, `HFS_EVENT_CONTRACT` and `BE_ASYNC_SPEC_MISSING`; `hfs emit-contracts` writes `be/contracts/<service>/events.json` from the literal `EVENTS` table of `apps/<service>/src/events.ts`. New slot `be.contract.events`.
- Changed: `hfs scaffold app` writes the final front end: two Next apps, `fe/apps/landing` and `fe/apps/app`, over the shared workspace packages `fe/packages/<name>-ui` (`@<name>/ui`: the brand shell, the locale shell and the boundary notices both apps mount) and `fe/packages/<name>-i18n` (`@<name>/i18n`: the next-intl stack written once, `createAppI18n` plus the `./proxy` and `./routing` subpaths; R59). hfs.json declares `fe.package.ui` and `fe.package.i18n`; each workspace's package.json declares exactly what its source imports; the request config still reads the locale through `next/root-params` (FE-I18N-1), now in the package. Template path variables: an fe `apps/<name>/` folder is the skeleton of that app alone (`__app__` is gone from the fe side), `__project__` is the project name.
- New: `hfs secret list|show|set|gen` (alpha.5 item 6.4), the canon command over the sealed secrets of `.starcistacks/<env>/secrets/<slug>.enc`, on the runtime's sops api (a new `seal` call: the value travels on stdin, never on an argument list). Replaces the plain `sops` commands of runbooks and KEYS.md files.
- Changed: HFS_REQUIRED_FILE_MISSING now also carries what BE_REQUIRED_MODULE_MISSING reported, and BE_TEST_TOPOLOGY what HFS_TEST_KIND_RETIRED reported (one code per obligation); the bundled architecture machine follows `APP_GUARD` and `APP_FILTER` providers built by a helper outside the app root file.
- Changed: the managed fe scripts (`dev:fe`, `start:<app>`, `build:fe`) run `next` from the app directory (`cd fe/apps/<app> && next ...`) so next-intl finds its request config; the fe skeleton reads the request locale through `next/root-params` (`experimental.rootParams`), pins the workspace root three levels above the app and uses the `.*[.].*` proxy matcher; the bundled runtime carries the `&&`/`||`-aware FE_SWR_KEY_IDENTITY check.
## Unreleased (a18 R281)

- Fixed: the bundled architecture machine (`function-spec-providers.mjs`, `unit-spec-providers.mjs`) takes the callable subset of a function-only subject's exports (constants, enums, re-exports and overload signatures are ignored) and lets the spec of a value-object class (undecorated, no constructor injection token) construct it with `new`.
- Security (canon pins, npm audit of 2026-10-16): `next` 16.1.6 to 16.4.2 (critical, with the `postcss` and `sharp` highs it brings), `axios` 1.15.2 to 1.20.0 and `@nestjs/platform-express` 11.2.5 to 11.2.7 (with `multer`) in `knowledge/hfs/canon-pins.yaml`; the example apps (`ecommerce-app`, `lite-app`, `shape-slot`) and `packages/test-world` carry the new pins and lockfiles.
- Known advisory, accepted (owner ruling `graphql-13-advisory-accepted-until-a19`, 2026-10-16): `@nestjs/graphql` and `@nestjs/apollo` stay on 13.4.5. `npm audit --omit=dev --audit-level=high` still reports their highs (and `@graphql-tools/utils` through them); the fix is 14.0.3, a semver major, deferred to alpha.19.

## Unreleased (C0 batch)

- Fixed (contract change `sonar-coverage-exclusions`): SonarQube has no `sonar.coverage.inclusions` property, so Sonar ignored it and counted every executable be/ file at 0% (overall coverage 65.8% and 45.2% on the examples, although every service was at 100). The managed `sonar-project.properties` now renders `sonar.coverage.exclusions` as the complement of the services. `coverageExclusions(presets, manifest)` in `sync/index.mjs` derives it from the preset's `COVERAGE_SOURCES` and the slot manifest, and lists:
  - every be role of the R89 suffix vocabulary other than `service`;
  - the be file names a slot declares outside it (`main.ts`, `index.ts`, `connection.ts`, the migrations, the test world's files);
  - `fe/**`.

  A coverage source whose complement Sonar's globs cannot write is refused (`HFS_SYNC_COVERAGE_SCOPE`). `sonar.coverage.inclusions` is deleted.
- Fixed: the fe skeleton's `[locale]/error.tsx` exports `ErrorBoundary` (Sonar S2137: `Error` shadowed the global).

## 4.0.7 - 2026-10-01

- Changed: the runtime layer check (scripts/api/<system>, a pure scripts/lib) in its bundled runtime.

## 4.0.6 - 2026-10-01

- Changed: R112 integration specs, the runtime api layer, the examples-root CI scope and the new pins.

## 4.0.5 - 2026-10-01

- Changed: workflow worktree runtime copies, the services coverage scope for Sonar and codecov.yml, sonar-gate, canon-pins.

## Unreleased (alpha.4, bumped in C0's batch)

- Changed (contract change `sonar-services-coverage`): Sonar and Codecov judge the services' coverage. The managed `sonar-project.properties` adds `sonar.javascript.lcov.reportPaths=be/coverage/lcov.info` and `sonar.coverage.inclusions=be/src/**/*.service.ts`; a new managed `codecov.yml` (slot `app.quality-config`, now `{sonar-project.properties,codecov.yml}`) holds the same paths at 100 on the project and the patch and ignores `fe/**`; the managed CI workflow uploads the be lcov with `codecov/codecov-action@v5` and the `CODECOV_TOKEN` secret after the unit run. Both files are rendered from one scope, `coverageScope(presets)`: the installed jest preset's `COVERAGE_SOURCES` on the be side (`loadPresets` now returns `coverageSources`). An app re-renders with `hfs sync --write`.
- Changed: the bundled runtime copies of `knowledge/sonar-gate.yaml` (coverage 100 overall and on new code, per file; every hotspot reviewed), `knowledge/hfs/slots.yaml` (the quality-config slot) and `modules/kernel/failure-codes.yaml` (the R11 law and HFS_SONAR_CONFIG text).

## 4.0.4 - 2026-10-01

- Changed: the bundled runtime copy of knowledge/hfs/canon-pins.yaml pins @starci/test-world 1.0.3. No rule or command changed.

## 4.0.3 - 2026-10-01

- Changed: the bundled canon-pins copy pins @starci/stylelint-canon 2.0.2, @starci/eslint-canon-be 3.0.3 and @starci/eslint-canon-fe 8.0.3, so `hfs scaffold app` writes those pins.
- Added: `npm test` (bin/hfs.test.mjs, not published): the CLI loads with no installed dependency, the clean-install proof of the package (scripts/checks/package-clean-test.mjs).

## 4.0.2 - 2026-10-01

- Changed (owner correction): `.starcistacks/` and `.sops.yaml` live at the app root, beside `be/`, `fe/` and `.starciwork`. The slots `be.starcistacks` and `be.sops` are replaced by `app.starcistacks` and `app.sops` (profile app, required); `repo.side-root-forbidden` now lists `.starcistacks/` and `.sops.yaml`, so a side holding either is `HFS_FORBIDDEN_PRESENT`, and the architecture machine reports a `.starcistacks` in either side as `HFS_STACKS_IN_SIDE` (it replaces `HFS_STACKS_IN_FE`). R10 `HFS_STACKS_SHAPE` judges the app root's tree.
- Changed: the managed `.gitignore` block carries the `.starcistacks` custody rules of `modules/schemas/stacks-layout.yaml` (`custody.gitignoreRules`, in order), rooted at the app root; an app keeps no hand-written custody block.
- Changed: `hfs scaffold app` writes `.starcistacks/application-stacks.yaml` and `.sops.yaml` at the app root (they were under `be/`); `hfs work-hygiene` guards the app root's `.starcistacks/`; the Sonar key and gate are read from `.starcistacks/application-stacks.yaml` at the app root.
- Changed: R47 `test-world-files` and R84 `connection-map` read the stack of the app root from the side they judge.

## 4.0.1 - 2026-10-01

- Fixed: `hfs scaffold app` no longer writes a hand-made lockfile. The 4.0.0 stub held only the root entry, so `npm ci` in a new app failed with EUSAGE ("package.json and package-lock.json are not in sync"). Once the files are written, the scaffold runs `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` in the new app root (registry or npm cache; no node_modules, no scripts), so the lockfile resolves every dependency of the root and its workspaces and `npm ci` accepts it. If npm cannot resolve it, the scaffold exits 2 with `HFS_SCAFFOLD_LOCK_FAILED`, names the step and removes the app it began: no stub lock and no app without a lock is left. There is no switch to skip the step.
- Fixed (false positive): R14 `HFS_DEP_VERSION_SKEW` does not report a bundled copy in the lockfile (`inBundle`, a package's bundleDependencies, e.g. the tslib inside `@tailwindcss/oxide-wasm32-wasi`): it ships inside its parent's tarball and nothing in the app can move it. A fresh scaffold's real lock has one.

## 4.0.0 - 2026-10-01

- Added: the scaffolded root `package.json` (and its lockfile root entry) pins `@starci/test-world` from `knowledge/hfs/canon-pins.yaml` (1.0.0), the package whose `starci-test-stack` bin the managed `test:stack` script runs.
- Changed: R47 `test-world-files` reads `test-world.config.ts` in the shape `@starci/test-world` defines and in its one named form `export const { useTestWorld, useSandbox } = defineTestWorld({ ... })` (the form R89 allows): `stack` names the environment, a stack service is faked only by its own `stacks` entry `{ fakedBy, reason }`, and a `fakes` entry of the declaration that fakes a stack service is refused like a `fakes/<provider>/` folder. A config with no readable named declaration (a default export included) is refused. The top-level `fakedBy` and the `stacks` list of environment names are no longer read.
- New (lane SHAPE): `HFS_PEER_INTEGRATION_MISSING` (R111). The app root package.json that depends on every package of a pair of `knowledge/hfs/peer-integrations.yaml` (at the named major) declares the pair's peer in its dependencies; the first pair is `@nestjs/apollo` on `@nestjs/platform-express` 11, which requires `@as-integrations/express5`.
- Changed (lane SHAPE): `HFS_PROOF_COMMAND_FILE_MISSING` (R105) judges the records naming a side (`repository: be` or `fe`) from the app root, where their proof commands run; a record naming another repository is still not judged.
- Changed (lane SHAPE): the managed `typecheck` script of an app with fe packages runs `npm run build --workspaces --if-present` before it type-checks the fe apps, which import the packages from `dist/`.
- Changed (lane SHAPE): `hfs scaffold app` writes `.starciwork/workspace.yaml` with the repositories `[{role: be, name: be}, {role: fe, name: fe}]`, the form of the examples.
- Fixed (lane SHAPE): slot be.tests.world allows `fakes/<provider>/server.ts`, so `BE_SOURCE_FORM` reads the fake server of a provider as its role instead of refusing the path `test-world-files` accepts.
- Breaking: the app monorepo standard. A product is ONE app repository `<app>/`: the root holds the one `package.json` (every dependency of both sides and every script; npm workspaces only for `fe/packages/*`), the one lockfile and `node_modules`, `hfs.json` of kind `app`, README, CI, `.husky`, `scripts/` and `.starciwork`; `be/` and `fe/` hold what the old back-end and front-end repository roots held except `package.json` and the lockfile. `hfs.json` is `{ "hfs": 2, "kind": "app", "project", "sides": { "be": { "apps", "optionalSlots", "connections" }, "fe": { "apps", "optionalSlots", "reads": ["be/contracts/"] } } }` (manifest major 2). The standalone `be` and `fe` repository kinds (`profile`, `stacks`) are deleted, with no alias.
- Breaking: `hfs init` is deleted; `hfs scaffold app <name> [--into <dir>]` writes the root, the `be/` and `fe/` skeletons and the app hfs.json, and refuses an existing directory. The fresh app lints clean (0 findings): the be skeleton is default-deny (throttler, CSRF origin guard, AuthGuard of `domain/identity`), carries the required platform capabilities (config, logging, errors, primitives, clock, i18n, cqrs, http-security) and the health feature; the fe skeleton mounts one pages feature per route slot, drawn with `@starci/grammar`.
- Breaking: `hfs lint`, `hfs check` and `hfs sync` run at the app root. The lint runs ESLint once per side (be/ with the BE canon, fe/ with the FE canon, each from its side folder with its one-line config), stylelint over fe/, the root checks once and the side checks and the architecture machine per side ("side view": each side judged with its folder as the root), and writes one `starci/lint@1` report and one Sonar import with app-relative paths. `--changed` keeps working with app-relative files. `hfs sync` renders the root files (package.json scripts `dev:be`, `dev:fe`, `build:be`, `build:fe`, `start:<app>`, `migrate`, `lint`, `test*`, `codegen`, `contract:emit`, `typecheck`, the hooks, CI, Sonar, prettier, the .gitignore block) and each side's managed files.
- Breaking: the front end reads `be/contracts/` in place for its codegen (`sides.fe.reads`); the front-end contract copy and its `HFS_CONTRACT_SNAPSHOT_DRIFT` hash comparison are gone.
- Changed: one version per dependency in the one package.json: a conflict between the sides takes its canon pin, otherwise the higher version, pinned in `knowledge/hfs/canon-pins.yaml` with a why (`graphql` 16.14.2).
- Changed: a side finding names every path from the app root, in its message as in its path (`fe/apps/web/...`, `be/src/...`), in `hfs check` and in the ESLint and stylelint findings of `hfs lint`.
- Fixed: the architecture machine gives each file to the deepest tsconfig project that holds it, so a route file importing its feature through the app alias `@/` mounts its owner (`FE_ROUTE_FILES_THIN` reported "0 feature owners"); the skeleton route slots import through the alias. A route file binding a declaration to a Next.js segment export (`generateMetadata`, ...) is not `HFS_ALIAS_REEXPORT`.

## 3.0.0 - 2026-10-01

- Breaking: one entry, `hfs lint`. It runs the repository's eslint, the `hfs check` repository pass and, for a front end, stylelint, and writes one `starci/lint@1` report; `--sonar <file>` writes the single Sonar import (engines starci-hfs, eslint and stylelint in one document); `--changed <files...> --format json` is the land-gate shape. `hfs report`, `hfs check --sonar` and the managed scripts `lint:check`, `lint:report`, `hfs:check` and `hfs:report` are deleted; the managed `lint` script is `hfs lint`, and CI, hooks and the Sonar template read `reports/lint.sonar.json`.
- Changed: 48 TS-attached architecture checks are served to eslint through one cached project graph (the `project-graph` law of both canons); `hfs check` keeps only findings with no TS file to sit on. The machine `size-growth` is gone (eslint `file-size-growth` holds the law).
- Fixed: workspace package imports resolve to their source (package `exports`/`types` mapped from dist to src through the package tsconfig), so `hfs check` needs no build and consumed exports are not reported unused; `ARCH_OWNER_EXPORT_BYPASS` accepts every entry the package's `exports` maps.

- Changed: Back-end apps have no composition spec. App slots admit only their production composition files, and R102 rejects a spec under `apps/<app>/src`. The e2e world proves that each app boots.

## 2.0.2 - 2026-10-01

- Fixed: `hfs` printed nothing and checked nothing when started through a node_modules junction or symlink (every lane worktree, some npx shims): the entry-point test compared `argv[1]` with the resolved module path. It now compares real paths (`isMain` of `scripts/checks/common.mjs`, shared by the bin and the architecture entry). Spec: `tests/hfs-cli-worktree.spec.mjs` runs `hfs check` inside a `git worktree add` checkout with a junctioned node_modules and requires a report or a loud refusal.

## 2.0.1 - 2026-10-01

- Fixed: `hfs sync` validates the whole hfs.json declaration against the manifest before rendering (a pre-2.0 `connections` list of names is refused), so a pin bump can never leave eslint unable to start.
- Changed: the back-end managed scripts carry `test:stack` (`starci-test-stack`); repo-specific devDependencies stay the repository's (sync owns only the `scripts` block and the canon pins).

## 2.0.0 - 2026-09-30

- Added (lane PORT): the repository scripts of the product repos are gone, so their laws live here. `repo.scripts` owns `scripts/{.gitkeep,*.mjs,*.cjs,*.ps1,*.sh}` (operational scripts, or an empty folder with `.gitkeep`, which `hfs sync --init` writes from `templates/{be,fe}/skeleton/scripts/.gitkeep`). New checks: `BE_SPEC_PLACEMENT` (R102, a spec outside the four test layers, `scripts/` and `tools/` included), `HFS_REPO_LOCAL_CHECK` (R103, a `check-*` file, `eslint-local-rules*`, a local plugin, a script that runs one), `HFS_LINT_SUPPRESSION_FILE` (R104, an eslint suppressions file, script or flag), `HFS_PROOF_COMMAND_FILE_MISSING` (R105, a `.starciwork` proof command that runs a file the repository does not hold; only records of this repository are judged) and, in the architecture machine, `FE_I18N_KEYS` (R106, a key the source reads that a locale lacks, a catalog key nothing reads). `HFS_DEP_VERSION_SKEW` (R14) also refuses a dependency declared at another version than the root `overrides` pin.
- Changed (lane PORT): `hfs work-hygiene` is the secrets guard of the commit for both profiles: every staged file, read from the index, is judged by the one secret judgement of `hfs check` (`secretFileFindings`: a secret by being, an `.enc` that is no sops envelope, a line that matches a secret pattern); the front-end pre-commit hook runs it too, and it runs first in both hooks. There is no override (the old `ALLOW_SECRET_SCAN`, the plaintext twin re-encryption and the `.enc` twin sync are gone).

- Changed: the back-end skeleton (`hfs sync --init`) follows the unit standard. It writes no spec but `*.service.spec.ts` (the specs of the controller, config, errors, logging and composition are gone), the health door is thin (`LiveController` dispatches one `CheckLivenessQuery` on the injected query bus, `CheckLivenessHandler.process` is one `return this.liveness.check()`, the liveness logic lives in `domain/liveness/liveness.service.ts` with its spec at 100 percent), and the platform gains `clock` (the one reader of the ambient time), `composition` (`injector`), `cqrs` (`ICQRSHandler`, the bus decorators) and `logging` decorators and log events; role-suffixed file names (`env-source.config.ts`, `domain.error.ts`, `logging.log-events.ts`, `json-logger.service.ts`). A repository lists `@nestjs/cqrs` in its dependencies and `tslib` in its devDependencies; `@nestjs/terminus` is no longer needed by the skeleton.
- Added: `hfs new service <dir> <name> [--inject ...]` and `hfs new spec <file>.service.ts` (`scaffold/service.mjs`): a back-end `*.service.ts` is created together with its `<name>.service.spec.ts` skeleton, built with `Test.createTestingModule({ providers }).compile()` and `moduleRef.get(Service)`. The constructor is read with the repository's TypeScript compiler API; each `@Inject*()` token and each class-typed parameter becomes one provider, its double chosen from `ruleParams.be.specDoubles` of the slot manifest (the table of the lint law `spec-infra-double-from-kit`), and every public method gets one placeholder `it`. The target must be owned by a slot; nothing is ever overwritten.
- Changed: Sonar no longer depends on coverage (unit test standard rule 6). The managed `sonar-project.properties` drops `sonar.coverage.exclusions` and `sonar.javascript.lcov.reportPaths`, `knowledge/sonar-gate.yaml` has no coverage condition (the gate keeps duplication, blocker and critical issues, hotspots, and zero open imported issues), and the managed CI workflows drop the Codecov upload and its `id-token: write` permission. `codecov.yml` is no longer a managed file (slot `repo.quality-config` is `sonar-project.properties` only) and `sync` no longer asks the installed preset for `sonarCoverageExclusions`. The managed back-end `test` script is `jest --selectProjects unit --coverage` (fails below the per-file 100 threshold), and a new `test:affected` (`jest --selectProjects unit --passWithNoTests`, no coverage) is what the pre-commit and pre-push hooks run over related or changed specs, because a per-file threshold judged on a partial run would fail every service the run did not touch; the front-end `test:ci` runs `vitest run` without coverage.
- Changed: a front end has no tests by standard (owner 2026-09-30). `hfs sync` no longer renders anything for a front-end test: no `vitest.config.ts`, `tsconfig.e2e.json`, `.github/workflows/e2e.yml` or `codecov.yml`; the front-end `package.json` scripts have no `test`, `test:ci`, `test:affected`, `typecheck:e2e` or `test:e2e`; the husky hooks and `ci.yml` run no test step and no codecov upload; `sonar-project.properties` carries no `sonar.tests`, `sonar.test.inclusions`, coverage exclusions or lcov path; the root `tsconfig.json` excludes only `node_modules`; `hfs sync --init` writes no spec and no vitest config; `loadPresets` needs no preset for a front end (`@starci/vitest-preset` and `@starci/playwright-preset` are deleted). Slots: `fe.e2e`, `fe.e2e-support` and the FE test roles are deleted, `fe.tool-config-repo` is `turbo.json` only, `codecov.yml` is a back-end slot (`be.codecov`). Added: `FE_NO_TESTS` (R97), the one front-end enforcer: any spec, e2e file, test directory, test-tool file, test script or test dependency is a finding, with no exception; R66 `FE_E2E_SHAPE` and R67 `FE_SPEC_QUALITY` are retired (rule ids increase and a retired id is never reused).

- Changed: R47 `test-world-files` (`BE_TEST_TOPOLOGY`) judges the world against the repository's own stack: `fakes/<provider>/` may not fake a service `.starcistacks/<env>` declares (name, image repository or a well-known alias: postgres, redis, keycloak, a mail host, ...). One exception: a stateless GPU or external-model service that `src/tests/world/test-world.config.ts` (the test-world library's declaration; its `stacks` name the environments) declares in `fakedBy` with a non-empty `reason`; a stateful kind or a service with a persistent volume is never accepted, and a `fakedBy` entry naming a missing stack service or fake folder is refused. The stack reader is `scripts/lib/stack-services.mjs`.

- Added: `hfs emit-contracts [--repo <dir>]` and the managed script `contract:emit`: writes `contracts/<app>/schema.graphql` of every api app that serves GraphQL as `printSchema(lexicographicSortSchema(schema))`. What an app serves is read from its source: the module graph is walked from `AppModule` of `apps/<app>/src/app.module.ts` through every import (imports of imports, `register`/`forRoot`/`forRootAsync` dynamic modules, `forwardRef`, spreads, both branches of a conditional), the `GraphQLModule` `include` list is honored, and an app whose graph holds no GraphQL server is skipped; only the resolver classes of the served modules are loaded, compiled the way `tsc` compiles them (decorator metadata comes from the type checker), and Nest's `GraphQLSchemaFactory` builds the schema, so it needs no environment, database or network and never boots the app. A dependency of a resolver that cannot load where the emit runs is stood in for and listed; a graph or option the reader cannot decide is an error naming the file. TypeScript, Nest and graphql are the repository's own. The rendered `.prettierignore` skips `contracts/`.
- Added: `hfs emit-contracts` also writes `contracts/<app>/openapi.json` (OpenAPI 3.1) for an api app whose `apps/<app>/src/operations.ts` exports the typed operation table `OPERATIONS` (canon BE-OPERATIONS-1): one `POST /operations` route whose body and answer are a oneOf over the operations, each with `x-operation: "<name>@<version>"`, the input, the output and the Outcome (`ok` value or declared refusal code); the schemas are read from the TypeScript checker, sorted, deterministic, and `any`/`unknown`/`Record<string, unknown>`/unbound generics/`string` refusal codes are errors naming the operation. The full `hfs check` compares it with the committed file (R23), and an operation table without a committed `openapi.json` is a finding.
- Changed: `hfs emit-contracts` folds only what literals decide: `if`/ternary/`&&`/`||`/`??` over the literal options an app passes (`register({ features })`, const-bound literals, spreads of consts, `list.push(...)`, early `return`) are followed to the branch they select; a condition it cannot decide (an env value, a call result, a parameter with no literal, an unknown list) is kept as an undecided choice and is an error, naming file, line and condition, unless every branch serves the same resolvers. Loops/switch/try that return or change a list, and objects or server options with an unknown spread, are errors.
- Added: the full `hfs check` (never `--fast`, which says so in its coverage line) emits every back-end api app into a temp directory and compares its hash with the committed `contracts/<app>/schema.graphql`; a mismatch is `HFS_CONTRACT_SNAPSHOT_DRIFT` naming both shas and `npm run contract:emit`, and an emit that cannot run is the same code with the emit error.

- Added: a front end's managed configuration, by the same mechanism as a back end (`fe.tool-config`, `fe.package-manifest`, forbidden `fe.tool-config-local`; `fe.thin-config` and the mixed `repo.package-manifest` are gone). `hfs sync` renders `tsconfig.json` (`@starci/tsconfig/next.json`), the one-line `eslint.config.mjs`, the one-line `stylelint.config.mjs` (`loadAppTokens(import.meta.url)`), `.prettierrc`, `.prettierignore` and the `scripts` block of `package.json` (`lint:check` = one ESLint run plus stylelint over `{apps,packages}/*/src/**/*.css`; `dev:<app>` and `start:<app>` per app). `turbo.json` is the repository's own (`fe.tool-config-repo`).
- Changed: the front-end hooks and workflow: pre-commit runs eslint, stylelint and prettier on the staged files (no lint-staged), pre-push adds `format:check` and `hfs:check -- --fast`, CI runs `hfs:report`, `lint:check` (with stylelint), `format:check`, `typecheck` and `build`.
- Changed: `hfs check` judges both profiles: `HFS_RULE_OFF_WITHOUT_REPLACEMENT` also for `stylelint.config.mjs`, `HFS_TS_STRICT` for the front end's root tsconfig, `HFS_TOOL_CONFIG_LOCAL` also for a stylelint plugin, stylelint flags and a tool configuration key of a `package.json`.
- Changed: one converter for both linters, `hfs report <eslint|stylelint> <in> <out>`; `hfs report-stylelint` is removed and `sonar.eslint.reportPaths` is no longer rendered (Sonar's own ESLint import drops issues on files outside `sonar.sources`). ESLint and stylelint findings on a file Sonar does not index are filed on the first source file with the real path in the message, like the HFS findings. `sonar.externalIssuesReportPaths` lists `reports/{hfs,eslint,stylelint}.sonar.json`; a front end's `sonar.sources` and `sonar.tests` include `packages` when hfs.json opts into a package slot, and its `sonar.typescript.tsconfigPaths` gains `packages/*/tsconfig.json`.
- Changed: the front-end skeleton (`hfs sync --init`): a one-app repository keeps its next-intl stack and its one API client in the app; a repository with two or more apps writes them once as `packages/<project>-i18n` (`createAppI18n`, `./proxy`, `./request`) and `packages/<project>-api` (`request`, `Outcome`) and keeps thin adapters in each app, and `--init` refuses it unless hfs.json opts into `fe.package.i18n` and `fe.package.api`. Every app also gets a `vitest.config.ts`; the shell reads `modules/i18n` through its index.
- Changed: the machine no longer treats a `lint:e2e` command as running e2e (linting is not running), and its root-entry allowlist accepts `stylelint.config.mjs`.

- Changed: `hfs check` runs the whole architecture machine after its slot, pin and size checks. Its violations and errors are findings under the machine's own rule ids, each with the Vietnamese why of its code, and any of them exits 1. The package carries a byte copy of the machine and every file it imports, plus the failure-code slice of every code the machine can emit. The machine loads `typescript` from the checked repository; a repository without it fails with `ARCH_TYPESCRIPT_MISSING`.
- Added: `hfs check --fast [--base <ref>]`, the flag the template pre-push hook already called. It judges the owners changed since the merge-base with `origin/main` (else `main`), skipping clones, dead exports and the file-system tree checks. With no merge-base it is a refusal (exit 2) that names the fix.
- Added: `HFS_EMPTY_DIR`, `HFS_GHOST_TREE` (an empty directory beside a sibling within two edits of its name) and `HFS_UNTRACKED_ROOT_ENTRY` (entries git neither tracks nor ignores, outside an `ignored` slot): rule R03 ships as an `hfs` enforcer.
- Changed: the machine's root-entry allowlist accepts `.prettierignore`, which the slot manifest already requires.
- Changed: one code per finding. `HFS_PATH_NO_SLOT` is `HFS_SLOT_UNDECLARED` and `HFS_REQUIRED_MISSING` is `HFS_SLOT_REQUIRED_MISSING` (the rule catalog's names); `HFS_STACKS_PLAINTEXT` of `hfs work-hygiene` is `HFS_PLAINTEXT_SECRET`. The old names are gone.
- Added: the owed `hfs` enforcers ship, each with a violating and a passing spec: `HFS_PLAINTEXT_SECRET` (R06), `HFS_STACKS_SHAPE` (R10), `HFS_CI_MISSING_CANON` (R13), `HFS_DEP_VERSION_SKEW` (R14), `HFS_CONTRACT_SNAPSHOT_DRIFT` (R23), `BE_TEST_TOPOLOGY` (R47), `FE_WIRE_GENERATED` (R52), `FE_I18N_PLACEMENT` (R59) and `FE_I18N_CATALOG` (R60) in `hfs check`; `HFS_GITIGNORE_BLOCK_DRIFT` (R04) and `HFS_SONAR_CONFIG` (R11) by comparing the file with its render; `HFS_FORMAT` (R19) by running the repository's own prettier (not under `--fast`; a repository without prettier is a refusal, `HFS_FORMAT_TOOL_MISSING`).
- Changed: a plaintext secret file the slot manifest forbids (`.env`, `*.pem`, ...) is one `HFS_PLAINTEXT_SECRET` finding, no longer also `HFS_FORBIDDEN_PRESENT`.
- Changed: the rendered `sonar-project.properties` carries no `sonar.host.url` (the host comes from the CI variable and the stack declaration).
- Changed: `hfs check` needs the repository's installed jest / vitest preset (the coverage exclusions of the render) and prettier; without either it refuses (exit 2) instead of skipping the check.
- Changed: owner test layout 2026-09-30. The tests' own `src/tests/tsconfig.json` (extends the root config and `@starci/tsconfig/e2e.json`) replaces `src/tests/e2e/tsconfig.json`; the managed root `tsconfig.json` excludes `src/tests/world`, `integration`, `e2e` and `contract` (fixtures stay in the root program). Scripts `test:integration`, `test:e2e`, `test:contract` (each `npm run typecheck:tests && jest --selectProjects <name>`) and `typecheck:tests` replace `typecheck:e2e` and `test:e2e:live`. `HFS_E2E_IN_AUTOMATIC_GATE` keeps integration, e2e and contract out of hooks, coverage and automatic CI. A slot forbids the retired `src/tests/e2e/world/` (goes to `src/tests/world/`); a spec whose suffix disagrees with its folder matches no slot.

- Added: `hfs sync` renders a back end's whole tool configuration from templates and `hfs check` compares it. The managed files are the slots of `slots.yaml` that name `managedBy` (each lists literal files; `managedBy` names the template directory `templates/<profile|common>/<managedBy>/`): `tsconfig.json` (extends `@starci/tsconfig/be.json`, adds the three aliases), `tsconfig.build.json`, `src/tests/tsconfig.json`, the one-line `eslint.config.mjs`, `jest.config.js`, `.prettierrc`, `.prettierignore`, and the `scripts` block of `package.json` (`lint`, `lint:check`, `typecheck`, `typecheck:tests`, `test`, `test:integration`, `test:e2e`, `test:contract`, `format`, `format:check`, `hfs:check`, `build`, one `start:<app>` per runnable app and `migrate`), compared as parsed JSON. Only the `.gitignore` block and `.starciwork/.gitignore` remain listed in code.
- Added: `hfs check` reports `HFS_MANAGED_FILE_DRIFT` (R05), `HFS_RULE_OFF_WITHOUT_REPLACEMENT` (R17, the eslint one-liner), `HFS_TOOL_CONFIG_LOCAL` (R16, tool configs outside the managed set, local rule files, flags that swap the configuration) and `HFS_TS_STRICT` (R22, by flag). The bundle no longer holds the templates; the check that renders them lives in `sync/`.
- Changed: the back-end hooks and workflows call only managed scripts: pre-commit runs `eslint` and `prettier --check` on the staged files instead of lint-staged, CI runs `npm run hfs:check` (the second `hfs sync --check` step is gone), `format:check` and `npm test -- --coverage --ci`; pre-push adds `format:check`. The front-end templates lose the `hfs sync --check` CI step.
- Changed: templates moved under `templates/<profile|common>/<managedBy>/`; `validateHfs` compares `hfs` with the manifest major (it wrongly demanded 2); a back-end app needs a `kind`.
- Changed: the machine's root-entry allowlist accepts `.prettierrc`.
- Changed: slots. `be.tool-config` (managed), `be.tool-config-local` (forbidden), `be.package-manifest`, `be.lockfile`, `be.nest-cli` and `fe.thin-config` replace the mixed `repo.tool-config` and `repo.package-manifest`; `repo.tool-config` keeps `.editorconfig` and `.nvmrc`. `.sops.yaml` no longer claims a `managedBy` nothing renders.

- Added: one Sonar mechanism for back ends and front ends. `hfs check --sonar <file>` writes the error findings as a Sonar Generic Issue Import document (engine `starci-hfs`, rule id = the finding code, catalog English and Vietnamese text, deterministic), and `hfs report-stylelint <in> <out>` converts stylelint's json output into the same format (`report/sonar.mjs`). The managed `sonar-project.properties` sets `sonar.eslint.reportPaths` and `sonar.externalIssuesReportPaths` and no longer sets `sonar.host.url` (R11); the managed CI workflows produce `reports/eslint.json`, `reports/hfs.sonar.json` (and the stylelint reports for a front end) and run the Sonar scan and gate with `!cancelled()`; a back end's scripts gain `lint:report` and `hfs:report`; `reports/` is an ignored slot.
- Added: `HFS_SONAR_CONFIG` (R11) ships as an `hfs` enforcer: `sonar-project.properties` differs from its render, or the stack declaration names another quality gate than the bundled `knowledge/sonar-gate.yaml`. The R20 and R21 Sonar enforcers ship as conditions of that gate file (`overall`: 0 open issues, duplicated lines density, S3776).
- Changed: every finding of `hfs check --json` carries the catalog's English `title` beside `titleVi`.

## 1.0.1 - 2026-09-30

- Fixed: `package.json` now has `exports` for `./runtime/*` and `./package.json`, so other published packages can resolve the runtime copy it carries (`@starci/hfs/runtime/knowledge/hfs/slots.yaml`, `@starci/hfs/runtime/engine/yaml.mjs`) with `import.meta.resolve` or `require.resolve`, wherever the package is installed. `@starci/eslint-canon-be` 1.7.1 reads the slot manifest this way.
- Changed: `CHANGELOG.md` ships in the package (`files`).
- The bin is unchanged; the runtime copy is resynced (`canon-pins.yaml` states the new pins).

## 1.0.0 - 2026-09-30

- First registry publication: the `hfs` command line with its runtime bundle, sync files and templates.
