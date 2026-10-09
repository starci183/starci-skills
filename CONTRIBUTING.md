# Contributing

StarCi is a kernel-agent workflow runtime. Before changing anything, read `CONTEXT.md`'s load order
and the contract YAMLs under `modules/` that touch your surface — contracts are data, and a code
change that contradicts them is a bug in the code.

## Setup

```sh
npm ci
npm run check   # starci runtime check: structure only, it never runs a spec
starci test affected --run   # the specs your change can break (see Verification)
starci runtime verify --base <tip you cut from>   # check AND the affected specs on one commit: the line a lane reports
npm run test:packages   # starci release clean-test: the spec suite of every package under packages/
```

`npm run check` is the repository wrapper for `starci runtime check`. During a focused
change, run one check with `starci runtime check --only <name>`.

`npm run check` and `npm test` do not run the spec suites of the packages under `packages/` (the eslint canons, stylelint,
tsconfig, prettier-config, jest-preset, test-world, grammar, heroicons, cli, hfs). `npm run test:packages` runs all of them, each from a
clean install of its own manifest and lockfile (about four minutes); `npm run test:packages -- --changed <file>...` or
`-- --base <rev>` limits it to the packages those files belong to, a runtime file a package bundles into its generated
`runtime/` copy (`scripts/hfs/**`, `scripts/lib/**`, `knowledge/**`) included. Run it after a change to such a file. CI runs it on
every run and the land gate runs it for the packages a land touches.

## Verification

Run `starci runtime verify --base <tip you cut from>` on the committed, clean tree and report its verdict; [useful verification](docs/verify-proof.md) owns the receipt and acceptance rules.
The affected-spec selection and reuse rules belong to [test affected](modules/cli/commands/test/affected.yaml); fix a red file, rerun it, then rerun the affected set.
Where the full suite runs belongs to [releasing](docs/releasing.md#where-the-suite-runs).

The supported Node.js 22/24 branches are declared in `package.json` `engines.node` and summarized in
[README prerequisites](README.md). Unflagged `node:sqlite` and the runtime capability checks are
required. Runtime code uses Node builtins, the vendored `engine/yaml.mjs` bundle and the production
dependencies declared in `package.json`: `libpg-query` parses PostgreSQL/PLpgSQL and `smol-toml`
parses TOML. `devDependencies` support contributor specs and tooling:

- `ajv` — schema assertions inside specs.
- `typescript`, `next`, `swr`, `@nestjs/*`, `@jest/globals`, `@types/jest` — fixture-resolution
  targets: compiler and framework checks resolve the actual target's declared dependencies;
  contributor fixtures may resolve this repository's development install.
- `yaml`, `esbuild` — only needed to rebuild the vendored `engine/yaml.mjs` bundle; the bundle is
  frozen, so most contributors never touch these.

## Test conventions

- Specs are flat: `tests/*.spec.mjs`, `node:test` + `node:assert`. No jest/vitest at root.
- Fixtures are built in tmp dirs (`fs.mkdtempSync` / `tests/fixtures/` builders) — never write into
  the repo under test, never commit generated fixture output.
- Temp files: the runtime creates every temporary file under `tempRoot()` (`engine/temp-root.mjs`: env
  `STARCI_TEMP_ROOT`, then `config.yaml roots.temp`, else the OS temp directory); runtime code calls `makeTempDir`/`tempPath` (`scripts/api/fs/`) or `tempRoot`,
  never `os.tmpdir()` or `fs.mkdtempSync(os.tmpdir())`, and its children get `TEMP`/`TMP`/`TMPDIR` from `tempChildEnv` (`engine/temp-root.mjs`), which the `scripts/api/` spawn wrappers apply. The suite
  preload `tests/setup/isolated-temp.mjs` reads only the environment, never the owner's `config.yaml`: it makes a fresh per-spec root inside
  `STARCI_TEMP_ROOT` (else the OS temp directory) and points `TEMP`, `TMP`, `TMPDIR` and `STARCI_TEMP_ROOT` at it, so
  `STARCI_TEMP_ROOT=<dir on another drive> node --test ...` puts the whole suite's files there. A spec run never reads the checkout's own `config.yaml` either:
  `loadConfig` and `inspectOwnerConfig` (`engine/config.mjs`) see an owner file only from under the directory `STARCI_OWNER_CONFIG_WITHIN` names (the spec preload sets it to the spec's temp root), where a fixture wrote it, so a lane clone, the release host and a clean checkout give one result.
- The release cut runs the suite under conditions a plain run of the whole suite does not have (`STARCI_REQUIRE_APP_INSTALLS=1`, `STARCI_REQUIRE_ORCA_LIVE=1`, real `npm ci` of every example app, a fresh `packages/test-world` build, the host's concurrency budget, an Orca terminal, a Docker daemon). `starci release env-test` (`npm run test:release-env`) runs the suite exactly so (`--lane` leaves out the Orca requirement a lane clone cannot meet; `--reuse-installs` keeps installed example apps): run it before asking for a release cut, and after a change to a spec's isolation, a verb catalog row or a git-dependent gate.
- No real network. Provider CLIs (`orca`, `devin`, `claude`, `codex`) are stubbed or recorded; a
  spec that would spawn a real agent is wrong.
- Specs may spawn `starci <group> <verb>` under test with `spawnSync` — that is the sanctioned
  process boundary. Assert exit codes and ledger state, not stdout poetry.
- Shared helpers live in `tests/helpers/`; the ledger fixture is `tests/helpers/ledger-fixture.mjs`.

## Evidence policy

Recorded evidence (example `.starciwork` trees, render proofs, coverage artifacts) is **re-run,
never hand-edited**. If a check's expected evidence drifts, regenerate it with the owning script
(`scripts/example/`, `scripts/checks/`) and review the diff — a hand-edited pass is a falsified
record and is worse than a red check.

## Repository conventions

- **One authority per concept.** A rule lives in exactly one file; other surfaces cite it. If you
  find yourself maintaining the same fact twice, one copy is stale — delete it or generate it.
- **Canonical import roots.** Mechanism comes from `engine/`, contract data from `modules/`
  (schemas from `modules/schemas/`), executables from
  `scripts/`. An import that resolves outside those three roots is the bug.
- **YAML contracts are data.** `modules/**/*.yaml` files are read by agents and scripts alike;
  keep them declarative — no code, no comments restating the field name.
- **The CLI catalog is authoritative.** `modules/cli/commands/` is the one source of the CLI
  surface. Adding a verb means adding its YAML file. Run
  `starci runtime check --only cli-catalog-drift`, regenerate stale outputs with
  `starci runtime gen-catalog --write`, and use `starci runtime gen-catalog --check` to confirm
  the generated catalog, reference, and completions agree. Keep the catalog parity and drift
  checks green.
- **Code style:** plain `.mjs`, node builtins preferred. Follow the comment contract in
  `docs/code-pattern-enforcement.md` (REF-COMMENT-1). Line endings are LF (`.gitattributes`
  enforces it — the install manifest hashes bytes).
- **State:** project and host state use their SQLite writers in `engine/db/ledger.mjs` and
  `engine/db/machine.mjs`; [storage](docs/ledger-db.md) owns their placement and lifecycle.
  [Prompt delivery](scripts/agent/prompt-file.mjs) owns the terminal bound, prompt-file placement and cleanup.

## Single source of truth (no duplicates, no redundancy)

A fact, a rule, a number, a path, a name or a helper has exactly one owner. Everything else reads it,
cites its id, or is generated from it. A second copy is a defect even when both copies agree today: it
is the one that goes stale. Eight principles, each held by a check that `npm run check` runs:

1. **Facts and slots have one machine source.** The product shape is `knowledge/hfs/slots.yaml`, the rules
   `knowledge/hfs/rules.yaml`, the claims `knowledge/hfs/facts.yaml`. Prose quotes a slot id, a rule id or a fact id and
   never restates the claim or lists the paths a slot owns (`RT_FACT_FALSE`, `RT_PROSE_RESTATES_SLOTS`,
   `RT_PROSE_PATH_NO_SLOT`, `RT_RULE_ID_UNKNOWN`, `RT_RULE_UNCITED`).
2. **What can be derived is generated, never typed twice.** The README sections 4, 5.1, 5.2, 6.1 and 12, the model
   catalog readers, the package `runtime/` copies and the ui message catalog come from their one source by a generator; a
   generated path is git-ignored and untracked (`RT_GENERATED_BLOCK_STALE`, `RT_GENERATED_DRIFT`, `GENERATED_UNTRACKED`).
3. **One definition of code.** A helper, a regex, a block of lines or an export exists once in `scripts/lib` or its
   owning module; an unused export is deleted (`RT_HELPER_NEAR_COPY`, `RT_HELPER_REDEFINED`, `RT_DUPLICATE_CODE`,
   `RT_EXPORT_UNUSED`).
4. **A literal has one owner file.** A port, a configuration default, a pinned version and a slot id are spelled where
   they are declared (`ui/ports.mjs`, `config.example.yaml` with `scripts/machine/home.mjs`, `knowledge/hfs/canon-pins.yaml`, the
   slot manifest) and read everywhere else (`RT_PORT_RESTATED`, `RT_CONFIG_DEFAULT_TWICE`, `RT_VERSION_RESTATED`,
   `RT_SLOT_ID_SHAPE`).
5. **One catalog per kind of name.** A failure code is catalogued once in `modules/kernel/failure-codes.yaml`, an
   environment variable once in its owner, a model, tier, price and pool once in `modules/models/registry.yaml`
   (`RT_CODE_UNCATALOGUED`, `RT_CODE_STALE`, `RT_CODE_MALFORMED`, `RT_CODE_SOLE_EMITTER`, `RT_ENV_UNCATALOGUED`,
   `RT_ENV_READ_OUTSIDE_OWNER`, `RT_TEST_ENV_IN_PRODUCTION`, `RT_ENV_STALE_ENTRY`).
6. **One allowlist and one shared schema fragment.** Every exception lives in `modules/kernel/allowlist.yaml` with its
   reason and only shrinks; a field shared by several schemas or ops is declared once and referenced
   (`RT_ALLOWLIST_SPRAWL`, `RT_SCHEMA_NOT_SHARED`, `RT_OP_FIELD_NOT_COMMON`).
7. **The runtime names no product and no example.** Runtime source is generic; a path it cites exists
   (`RT_EXAMPLE_COUPLING`, `RT_PRODUCT_NAME_IN_SOURCE`, `RT_HOST_PATH_IN_TEMPLATE`, `RT_CITED_PATH_MISSING`).
8. **One document and one spec per behaviour.** Every `docs/*.md` carries an `Owner:` or `Task:` line and no two docs serve
   one task; a spec asserts behaviour, not source text, and a skip says why; a CI upload fails loudly
   (`RT_DOC_NO_OWNER`, `RT_SPEC_ASSERTS_SOURCE_TEXT`, `RT_SPEC_SKIP_UNEXPLAINED`, `CI_UPLOAD_NOT_SILENT`).

When a check names a copy: find the owner (the machine file above), keep the one definition there, and make the other
site read, cite or generate it; delete the copy in the same commit. Do not add an allowlist entry, a baseline or a
suppression: the first fix is always to remove the duplicate. If you cannot tell which copy is the owner, the fact has no
owner yet: create it in the machine file first, then point both sites at it.

## Parallel lanes

Kernels run `.claude` main live, so no one edits the main checkout in place. A large change is cut
into lanes with disjoint write-allowlists. Each lane works in an ephemeral worktree under
`<lanesRoot>/<lane>` (the lanes root is `STARCI_LANES_ROOT`, else the owner config `roots.lanes`,
else the per-user lanes directory outside the checkout; `lanesRoot()` in `scripts/machine/home.mjs`), never with junctions or symlinks. It lands one commit at a time with
`starci supervisor land --commit <sha> --lane <lane>`, which cherry-picks, gates and fast-forwards local main.

- `land.mjs` runs from the main checkout, never from the lane worktree.
- A lane writes only inside its allowlist. A defect it finds elsewhere goes into its report for the
  owning lane, not into a drive-by edit.
- A lane that depends on another's surface starts after that one merges, and merges `main` before
  it reads anything.
- A lane finishes by submitting its report through the kernel (`starci kernel report`) so the ledger records
  the outcome; no report, the lane is not done.
- Deletions and import rewiring that cross allowlists are their own cut, merged between lanes.

## Upgrading the runtime

Every runtime change meets these rules on top of the commit bar:

1. **Fix the layer, not the symptom.** When a mechanism misbehaves, change or delete it. Do not add a flag,
   gate or guard that polices it.
   Before adding a mechanism, grep for one that already solves the problem.
2. **One copy.** Reuse the exported helper; never paste a helper, regex or constant into a second file.
   A copy that exists already gets merged in the same cut that touches it.
3. **Wire what you declare.** A yaml key, schema field or op rule that no code reads is deleted, not kept
   as documentation. Numbers follow rule 3 of the prose rules below; code keeps no second literal default.
4. **Instructions are rules, not essays.** Agent-facing text states the rule first, once, with no history,
   rationale or repeated caveat. Every wake or refusal string is paid for on every send.
5. **System sources win.** Grammar, brand tokens, shared registries and the message catalogue outrank
   generated images and agent opinion. Never route a question to the owner that one of them answers.
6. **Fail closed, visibly.** A gate that crashes must not pass. No empty `catch`, no `|| true` on a
   check whose failure matters.
7. **Safe to hot-load.** Preserve actual admitted scope, caller/incarnation, native effect custody and filed evidence.
   New admission requires the exact current READ manifest and current safeguards. Unknown custody stays held.
   A source change never closes, restarts or rewrites live terminals, ledgers or product files.

## Removing or renaming a spelling

Removing or renaming any key, flag, verb, field or code adds, in the same commit, one entry to
`modules/kernel/removed-vocabulary.yaml`: the removed spelling (a literal name, or a `match` regular expression when the
bare name is a common word), what replaced it, and the release that removed it. The runtime's refusal of that spelling reads
the same entry, so the refusal says what to write instead. The self-check `removed-vocabulary` (`RT_REMOVED_VOCABULARY`)
scans `skills/`, `docs/`, `README.md`, `CONTEXT.md`, `CONTRIBUTING.md`, `modules/` and `knowledge/` and refuses any removed
spelling there; a spec (`tests/**/*.spec.mjs`) may spell one only on a line, or under a test title, that says refuse, reject, removed, throws or unknown, so a spec of a removed thing is deleted or turned into a refusal assertion. The same commit rewrites every instruction that still teaches it. Exempt: the list file, `CHANGELOG.md`
and a removed-list, which is a line carrying the marker `[removed-list]` or a block under a marker that stands alone on a
comment line (`<!-- [removed-list] -->` in Markdown, `# [removed-list]` in yaml) up to the next blank line.

## Commit bar

- The checks required by [useful verification](docs/verify-proof.md) pass for the cut's actual change.
- `node --check` on every edited `.mjs`.
- Verify before committing: run the thing you changed, not just the tests that happen to cover it.
- Do not commit `config.yaml`, `settings.local.json`, `.starciwork/`, `node_modules/` or anything
  else `.gitignore` covers.

## Pushing and releasing

The remote `main` of this repository is not pushed between releases. A land fast-forwards LOCAL main under the [verification rules](#verification); nobody pushes to obtain a CI or SonarCloud reading.
Main goes to the remote exactly when a release milestone is cut, in one atomic push of main and one annotated `v*` tag, through `starci release cut --tag v<version>` (`--plan` reports what it would run and require; it runs nothing).
The installed pre-push hook (`scripts/guards/release-push-gate.mjs`, written by `starci runtime link`) makes that mechanical: it refuses a push of `main` or of a `v*` tag unless the pushed commit is a release commit — the version moved past the remote main's, an annotated tag `v<version>` on it, a dated CHANGELOG heading for exactly that version, and the release record of that exact commit with a green full suite, packages suites and checks. The refusal names what is missing and the command that produces it; there is no bypass switch.
R221 `CI_TRIGGERS_RELEASE_ONLY` refuses any other workflow trigger and R222 `RELEASE_NOTES` refuses a tag over unfinished CHANGELOG notes. The model, the release definition, the refusals and the risks are in [git governance](docs/git-governance.md).

## Editing contracts and prose

Every canonical file — `CONTEXT.md`, `README.md`, `docs/**`, `modules/**`, `skills/**` — says
one thing, once, in the present tense. These six rules are the bar for any edit on the alpha
line; a review that finds a violation sends the change back.

1. **Present tense, no ghosts.** Describe the tree as it is. Never define something by negating
   a state the tree no longer has (a removed directory, a former layout, a compatibility mode). History goes to `CHANGELOG.md`, never into the
   sentence that defines the present.
2. **Replace, never append.** A feedback edit rewrites the sentence that holds the rule. Do not
   add a second sentence under the first, and do not leave the old condition clause standing
   when the new rule carries its own. One concept has one paragraph and that paragraph is the
   latest version. A summary block (`business:` in an op, a README list) is regenerated in the
   same commit or deleted.
3. **One place to do, one place to check.** Inside an op manifest a rule appears in exactly one
   `steps[].action` and in at most one `proofs[]` entry. `reads` and `writes` describe data, not
   rules. Numbers — rounds, candidates, timeouts, retry limits, cadences — are data in one yaml
   that code reads; they are never prose repeated in several files.
4. **Claims must execute.** `citation:`, `enforcedBy:`, `source:`, "validated by", "refuses",
   "verified before effects" name a file and a behaviour that exist. If the code does not do it,
   the yaml says so or the claim is removed. On the alpha line the default is to make the yaml
   tell the truth; add code only where a test shows a real hole.
5. **Host calls go through `scripts/api/orca/`.** No agent-facing prose tells an agent to run
   `orca` or to read `modules/host/**`; agents call `scripts/kernel/cli.mjs` or a wrapper.
6. **Every cut lands with evidence.** `node --check` on touched `.mjs`, the specs that cover the
   touched surface, and — when a rule moved — the check that would catch it moving back.
