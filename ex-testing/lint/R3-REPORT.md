# R3 — ENTRY/DISTRIBUTION SURFACE report

Lane `r3`. Surface: `bin/`, `cli/`, `init/`, `docs/`, all root files, `scripts/` layout
convention. Read-only research; nothing moved, nothing committed.

New-arch anchors used as the verdict baseline (verified, not assumed):

- `scripts/kernel/api.mjs` — the kernel agent's only mutation gate
  (`survey|status|plan|enqueue|dispatch|settle|incident|retire`); imports
  `kernel/ledger-db.mjs` + `core/yaml.mjs`; spawns ops via the `orca` CLI directly
  (`api.mjs:289-324`) — **it never calls `bin/` or `cli/`**.
- `scripts/kernel/start-workflow.mjs` — claims inbox row, routes kernel host via
  `scripts/route/route-model.mjs` (kind `model.manageWorkflow`), reads
  `scripts/kernel/kernel-prompt.md` (:155), spawns via `orca` + adapter YAML.
- `scripts/goal/define-goal.mjs` — calls `scripts/route/route-plan.mjs` (:68) and
  `scripts/goal/assess.mjs` (:78); writes `runtime.sqlite` via `kernel/ledger-db.mjs`.
- `scripts/kernel/kernel-prompt.md` — the [Kernel] load order is
  `SKILL.md → modules/kernel/{driver-loop,api,dispatch,verdict-contract}.yaml`.
- Entry skills `define-goal`/`start-kernel` live at **`<Source>/.devin/skills/`**
  (host repo root), NOT inside `.claude` — see §6 finding P1.

## 1. `bin/` — install story

| File | Verdict | Evidence |
|---|---|---|
| `bin/starci.mjs` | **MERGE → shrink to install shim** (or delete if `package.json.bin` points at `scripts/install/install.mjs` directly) | Three roles today: (a) forward `LAUNCHER_COMMANDS` to `hosts/orca/launch.mjs` (:10-13,65-76) — dies with old engine; (b) forward `init/update/doctor/version/help` to `bin/starci-skills.mjs` (:77-83) — survives; (c) forward everything else to `cli/main.mjs` (:84-89) — dies. Only (b) survives the cut. |
| `bin/starci-skills.mjs` | **MOVE → `scripts/install/install.mjs`** | The whole installer: `PAYLOAD` = `package.json.files` (:31), `copyPayload` into `<repo>/.claude` (:209-220), bootstrap write (:270-281), `config.json` seed via `loadConfig(target,{initialize:true})` (:434,489), manifest `.starci-skills.json` (:198-207), retirement plan (:337-398), `doctor` running `tests/*.spec.mjs` (:519-550). Imports `scripts/config/config.mjs` + `kernel/common.mjs` (`ENGINE_SCHEMA`, :15) — both need homes under the cut (see §5). |

**Minimal install path for the new tree** (what the installer must actually do):

1. Copy declared payload → `<host>/.claude` (payload = `modules/ engine/ providers/
   skills/ init/ knowledge/ docs/ examples?/ tests?/ scripts/ SKILL.md README.md
   LICENSE THIRD_PARTY_NOTICES.md config.example.yaml package.json`).
2. Write host bootstrap file(s) from `init/` (currently 3 names × identical bytes).
3. Seed ignored `config.json` from `config.example.yaml` if model-pool config is
   retained (see §5 — the new `route-model` path does **not** read config.json;
   only the installer and the old engine do).
4. Write `.starci-skills.json` manifest; run doctor on the install's own specs.
5. **Missing today:** install/copy the entry skills (`define-goal`, `start-kernel`)
   to a host-discoverable skills dir — they currently exist only at
   `<Source>/.devin/skills/` outside the package, so a fresh open-source install
   has no lifecycle entry (P1 below).
6. `.starciwork` init is *not* the installer's job today — the ledger is created
   lazily by `ledger-db.mjs` when `define-goal`/`start-workflow` first open it.
   Keep it that way.

`scripts/install/` vs `bin/`: the installer is 604 lines of library-style code —
it belongs in `scripts/install/`; `bin/starci.mjs` survives only as the ~20-line
`npx starci` shim forwarding `init|update|doctor|version|help`. Alternative with
one less root: drop `bin/` entirely and set `"bin": {"starci":
"scripts/install/install.mjs"}` — npm bins don't need a `bin/` dir. Recommend
the `bin/` shim anyway for a stable `node .claude/bin/starci.mjs` muscle-memory
path; either satisfies the HFS `install?` slot.

## 2. `cli/` — DELETE

`cli/main.mjs` (530 lines) implements exclusively old-engine inspection commands:
`workspace init`, `storage`, `source-layout`, `validate`, `tree`, `impact`,
`stale`, `ops`/`op`, `workflows`/`workflow`, `route`, `agent-route`, `execution *`
(7 subcommands, `../execution/*`), `approval *` (`../approvals/*`), `plan`
(`workflows/lifecycle.mjs`), `audit-legacy`, `identity`, `brand`, `render`,
`work status`, plus thin forwards into `scripts/checks/*` (`architecture`,
`code-patterns`, `check-stales`, `work-change`, `stacks`, `work-layout`).

- Every surviving behavior is reachable directly via `node scripts/checks/<name>.mjs`;
  the check scripts already have their own argv handling.
- New-arch code does not import it (`api.mjs`, `start-workflow.mjs`,
  `define-goal.mjs`, `route-*` — none reference `cli/`).
- Referenced only by old-engine callers: `bin/starci.mjs:86,88`, installer
  `doctor` modernity probe (`starci-skills.mjs:523-526` — hard-fails an install
  lacking `cli/main.mjs`; this probe dies with the old CLI), and old-engine specs
  (`cli.spec.mjs`, `cli-ledger-commands.spec.mjs`, `code-patterns-cli.spec.mjs`,
  `integration.spec.mjs`, `npm-package.spec.mjs`, … — all rewritten/deleted in
  the cut).
- `INDEX.yaml:23` (`cli: Inspection commands`) dies with INDEX.yaml (§4).

## 3. `init/` — KEEP dir, collapse to one template

All three files are **byte-identical** (1001 B each; `diff -q` clean) and the
installer *requires* that (`starci-skills.mjs:113` throws unless
`CLAUDE_BOOTSTRAP === BOOTSTRAP === DEVIN_BOOTSTRAP`). That is stored triplication
of one template plus ~15 hardcoded historical variants inside the installer.

**Currency check:** the templates are one generation *behind* the installed host
bootstrap. `init/*.md` still carries the `.workspaces` + storage-sentence
prompt-entry; the host's actual `AGENTS.md`/`CLAUDE.md` (repo root, identical to
each other, **no `DEVIN.md` installed**) already speak the new model — "runtime
tree is canonical source, there is no build step", lifecycle entries
`define-goal`/`start-kernel`. The installer's `STORAGE_SENTENCE` assert (:99-112)
is pinned to the stale wording — regenerating the template requires updating that
assert family too.

Correct template set (per brief's AGENTS.md-only model + observed host state):

- `init/AGENTS.md` — the single canonical template, reworded to the new entry
  (define-goal/start-kernel, `.starciwork/runtime.sqlite`, no build step).
- `init/CLAUDE.md`, `init/DEVIN.md` — **stop storing duplicates.** If multi-host
  names are still wanted, emit copies of the one template at install time; if
  the owner's AGENTS.md-only ruling holds, drop both names from
  `bootstrapPlan`/`writeBootstraps`/`checkRetiredHostReferences` and from
  `scripts/checks/check-entry.mjs:9` (which enumerates the same triple).
- Either way the ~15 legacy prompt-entry variants in the installer stay — they
  are `update`-time recognition, not payload — until the installer's retirement
  policy is itself scoped.

## 4. Root files

| File | Verdict | Evidence |
|---|---|---|
| `SKILL.md` | **KEEP (rewrite)** — entry skill | §6 below. |
| `README.md` | **KEEP (rewrite)** — already structured as the OSS readme (Quick start/Install/CLI/Troubleshooting/Docs sections) | §CLI (:180-196), "How delivery works", "Execution modes", "Workflow kernel" sections describe the dead `starci <workflow-*>` command line; Documentation index (:213-229) links ~10 docs deleted by the cut. |
| `VERSION` | **DELETE** — SSOT violation | Contains `1.0.0-alpha.1`; `package.json` says `1.0.4`. Nothing reads `VERSION` programmatically (only `SKILL.md` prose "(see `VERSION`)"); `kernel/engine.mjs:22` reads `package.json` version. npm requires package.json anyway — it wins. |
| `README.yaml` | **DELETE (or MERGE into package.json)** | `starci/readme@3` duplicates `package.json.description`, `INDEX.yaml` and release status. Read programmatically only by `kernel/runtime-pin.mjs:37` (old engine). |
| `INDEX.yaml` | **DELETE (regenerate if wanted)** | `starci/layout@3` folder catalog is already stale (no `execution/`, `engine/`, `.experiments/`; describes `workflows/`, `hosts/`, `cli/`). Consumers: `runtime-pin.mjs:37` + `tests/skills-tree.spec.mjs:22` — both old engine. The draft HFS omits it, consistent with delete; if a tree index is wanted it must be *generated* (like `build-ops-registry.mjs`), never hand-maintained — see SSOT V4. |
| `UPDATE.yaml` | **DELETE (salvage to CONTRIBUTING)** | Runtime-maintenance rules for the old engine (runtime-layout block describes `kernel/ hosts/ execution/` verbatim). The evergreen rules — one-authority-per-concept, verify-before-commit, no-publication-without-authority — belong in `CONTRIBUTING.md`/`docs/releasing.md`, not a second prose file nothing loads. |
| `MASTER.md` | **DELETE** | Self-declared: "not runtime content … deleted when the last workstream is closed" (:8-9). Refactor plan; superseded by `.experiments/OPENSOURCE-GOAL.md`. |
| `PARALLEL-AMAP.md` | **DELETE** | One-off mission doc for the examples wave; references retired paths (`ops/`, `model/`, `scripts/example-evidence.mjs`). |
| `goal.md` | **DELETE** | Session goal ("2026-09 session goal"); `MASTER.md:24` already calls it root noise. Distinct from per-workflow `goal.md` files the old kernel wrote. |
| `config.example.yaml` | **KEEP** (if owner model-pool config is retained) | Seeded to `config.json` by `loadConfig(...,{initialize:true})`; shipped in `files`; validated by `scripts/config/config.mjs`. Caveat: see §5 — new-arch `route-model` does not consume it; keep only if the new model-routing still honors owner pools/language/effort. |
| `config.json` | **KEEP semantics, stays untracked** | Host-local, gitignored (`/config.json`), never shipped. |
| `settings.local.json` | **No action** | Claude Code local settings; gitignored, untracked, not in `files`. |
| `LICENSE` | **KEEP** | MIT. |
| `THIRD_PARTY_NOTICES.md` | **KEEP** while `core/yaml.mjs` (→ `engine/yaml.mjs`) bundles yaml 2.9.0 | `docs/releasing.md` requires retaining the notice. |
| `package.json` | **KEEP (rewrite `files`)** | `files` lists `sites/skills/*` and `sites/docs/*` — **`sites/` does not exist on disk** (payload gap, harmless to npm but wrong); plus every doomed dir (`cli/ hosts/ execution/ contracts/ approvals/ workflows/ upgrades/ legacy/ops/`). New `files`: `bin/ init/ skills/ modules/ engine/ providers/ knowledge/ schemas?/ scripts/ docs/ examples/ tests/ fixtures?/ + root md/yaml`. `bin` → `bin/starci.mjs` or `scripts/install/install.mjs`. |
| `.gitattributes` `.gitignore` `.github/` | **KEEP** | LF normalization is load-bearing for hashTree (`starci-skills.mjs:194`); `.github/workflows/{example-coverage,todo-app-example}.yml` are example CI. |

## 5. `scripts/` layout audit

Current folders vs proposed `{goal,kernel,route,checks(+spec),example,install?}`:

| Folder | Verdict | Notes |
|---|---|---|
| `goal/` (`assess.mjs`, `define-goal.mjs`) | **KEEP → `scripts/goal/`** | New-arch lifecycle entry. |
| `kernel/` (`api.mjs`, `kernel-prompt.md`, `start-workflow.mjs`) | **KEEP → `scripts/kernel/`** | `kernel-prompt.md` is prompt *data* consumed by `start-workflow.mjs:155`; candidate for `modules/kernel/kernel-prompt.md` if the convention is "scripts = code only" — flag, not required. |
| `route/` (`route-model`, `route-op`, `route-plan`, `dispatch-op`, `build-ops-registry`) | **KEEP → `scripts/route/`** | All new-arch: route-model feeds start-workflow + dispatch; route-plan feeds define-goal; route-op is the plan-time op pick (`modules/kernel/driver-loop.yaml:159`); build-ops-registry is the registry generator/`--check`. |
| `checks/` (45 files) | **KEEP → `scripts/checks/`** (per-file triage belongs to the quality lane) | Split observed: product-quality gates (`architecture/`, `code-patterns/`, `brand`, `render`, `stacks`, `proof`, `acceptance`, `check-stales`, `work-change`, `work-layout`, `check-work-*`) vs repo-dev tooling (`check-example-*`, `check-entry`, `check-json-exceptions`, `check-scoped-lint`, `probe-reference-conventions`, `sanitize-orca-fixture`). `check-entry.mjs` hardcodes the AGENTS/CLAUDE/DEVIN triple — update with §3. |
| `example/` (7 files) | **KEEP → `scripts/example/`** | Example-derivation/evidence tooling; `example-ownership.mjs` is imported by `scripts/route/dispatch-op.mjs:34` (live edge into the new arch). |
| `config/config.mjs` | **NO HOME IN DRAFT — flag** | Live edge: installer `init/update` seed `config.json` through it; `modules/models/index.mjs`, `models/functions.mjs`, old `kernel/*`, `cli` consume it. Under the cut its only *new-arch* consumer is the installer itself. Either (a) keep config → `engine/config.mjs` (it is runtime data loading, not a check), or (b) drop host config entirely and delete it with the old engine. Decide with the model-routing contract, not here. |
| `work/` (`plan.mjs`, `present-goal.mjs`, `work-remap-path.mjs`) | **DELETE** | `plan.mjs`/`present-goal.mjs` import `workflows/plan.mjs`, `workflows/storage.mjs`, `workflows/auto.mjs` — all dead. `work-remap-path.mjs` is a one-off dev tool over the old Work tree. |
| `ledger/ledger-migrate.mjs` | **DELETE** | Imports `kernel/{journal,loads,store}.mjs` — all old engine. A clean open-source tree has no `_local`/journal installs to migrate; if a transition is wanted it lives one release in `scripts/install/` or a pinned legacy tag, not the new trunk. |

**Homeless-script check:** after the above, every surviving script lands in
`{goal,kernel,route,checks,example,install}` + one flagged (`config/` → `engine/`
or delete). The draft set covers the tree **iff** `config.mjs` gets an answer.

## 6. SKILL.md load-order review

142 long lines: a new-arch preamble (¶1-2 — distless layout, `define-goal` +
`start-kernel`, kernel-agent + `api.mjs` model — **already correct**) welded onto
the old-engine skill. Sections needing rewrite/deletion:

- **¶1 layout sentence** — names `kernel/` spine, `schemas/`, `modules/`;
  update to `engine/` + `modules/` + `scripts/` of the new tree.
- **"StarCi 1.0 … execution contract" (¶3-4)** — `starci/engine@1`,
  `upgrades/1.0.0.md`, native-host isolation: old-engine contract → delete or
  compress to a pointer.
- **Product-doctrine paragraphs** (architecture-rules, coding-reference,
  design-pattern catalog, backend/portable source, SRS/SDS source-of-trust) —
  **KEEP**, they are the quality bar, independent of engine.
- **Check paragraphs** — `starci check-stales/architecture check/…` CLI names →
  re-point to `node scripts/checks/<name>.mjs`.
- **Orca/kernel execution paragraphs** (~¶43-58: `bin/starci.mjs` command list,
  `workflow-goal/-approve/-run`, `hosts/orca/launch.mjs`, `providers/orca/calls.yaml`,
  solo mode, headless adapter, `workflow-amend`) — old engine → rewrite to the
  kernel-agent loop: `api.mjs` verbs, `providers/orca/adapters/*.yaml`, one
  ephemeral op per job. `kernel-prompt.md`'s own "MANDATORY LOAD ORDER" already
  duplicates this — pick one owner (SSOT V8).
- **Plan-route paragraphs** (`workflows/plan.yaml`, `plan.mjs`, auto/delegation,
  `approvals/policy.yaml`, workflow-goals, delivery-review, scoped-approval) —
  old engine → delete or re-scope to the goal/chain model.
- **Bootstrap/storage/workspace paragraphs** — `config.json` init (keep if
  config survives), `schemas/workspace-routing.yaml` (keep — `define-goal.mjs`
  uses it), `bin/starci.mjs storage/source-layout` commands (delete),
  `init/` triple (update per §3), Work-tree paragraphs (`schemas/work-layout.yaml`,
  `features/**`) — old Work model; re-scope to whatever the new ledger+evidence
  model keeps.

## SSOT violations found (this surface)

1. **Bootstrap triplication:** `init/{AGENTS,CLAUDE,DEVIN}.md` are byte-identical
   and asserted identical by the installer (`starci-skills.mjs:113`); the same
   triple is re-enumerated in `check-entry.mjs:9`, `writeBootstraps`,
   `checkRetiredHostReferences`, `tests/engine-lifecycle.spec.mjs:49`. One
   template + a name list is the single source.
2. **Template already stale vs installed bootstrap:** host `AGENTS.md`/`CLAUDE.md`
   carry the define-goal/start-kernel entry; `init/` still carries the
   storage-sentence generation — the very drift the installer's
   STORAGE_SENTENCE assert was built to prevent (it pins template wording, not
   meaning).
3. **Version fork:** `VERSION`=`1.0.0-alpha.1` vs `package.json.version`=`1.0.4`
   vs `README.yaml`=`1.0.0-alpha.1` vs `INDEX.yaml`=`1.0.0-alpha.1`.
4. **Layout described 4×:** `INDEX.yaml.folders`, `UPDATE.yaml` runtime-layout
   block, `docs/config-format.md:71`, `README.md` §Canonical-sources — all
   already disagree with the disk (missing `execution/`, `.experiments/`,
   `engine/`; `sites/` in `files` but absent).
5. **Command surface 4×:** `bin/starci.mjs` KERNEL_HELP, `cli/main.mjs` help,
   `hosts/orca/launch.mjs:717-819` usage block, `docs/cli.md` + `README.md` §CLI.
   Under the cut there is one help text: the installer's.
6. **Kernel load order 2×:** `SKILL.md` prose vs `scripts/kernel/kernel-prompt.md`
   "MANDATORY LOAD ORDER" — they already enumerate different lists.
7. **Docs count claims:** `MASTER.md` says docs/=78 files; disk has 70 top-level
   `.md` + 2 subdirs — harmless, but shows hand-maintained inventory rots fast.

## HFS critique (draft vs this surface)

- **`bin/` absent from the draft** — but `package.json.bin` must point somewhere
  for `npx starci`. Either keep `bin/starci.mjs` as the install shim or point
  `bin` at `scripts/install/install.mjs`. Not free: `starci-skills.mjs` resolves
  `packageRoot` from `import.meta.url` and reads `init/`+`package.json`
  relative to it — a move to `scripts/install/` changes that depth (`../..` not
  `..`); mechanical but must be done with the move.
- **`scripts/install/` should be non-optional** — the installer is the product's
  front door for open source; `install?` in the draft undersells it.
- **Missing from the draft: the entry skills' ship path.** `define-goal` /
  `start-kernel` SKILLs live at `<Source>/.devin/skills/` — outside `.claude`,
  outside `files`, outside every installer rule. The draft `skills/` dir holds
  companion skills only. For a stranger's clone to work, either ship them as
  `skills/define-goal|start-kernel/` inside the package and teach the installer
  to link/copy them to the host's skills dir(s) (`.devin/skills/`,
  `.claude/skills/`, `.agents/skills/` — a per-host matrix the installer must
  own), or document manual copy in README. Today neither exists. **This is the
  largest gap this lane found.**
- **`engine/` must absorb two strays this surface needs:** `kernel/common.mjs`'s
  `ENGINE_SCHEMA` (installer's install-protocol marker) and
  `scripts/config/config.mjs` — unless host config is dropped entirely.
- **`docs/` survives** but the draft gives no rule for old-engine vs doctrine
  docs; classification below supplies it. `docs/supervision-templates/op.md` is
  old-engine payload read by `kernel/kernel.mjs:4344` — dies with it, do not
  carry it as "docs".
- **Root-file set in the draft is correct** (`SKILL.md README.md LICENSE VERSION
  package.json`) *except* `VERSION` should be deleted rather than kept —
  package.json is the version source; keeping both re-creates violation V3.
  `THIRD_PARTY_NOTICES.md` is missing from the draft root and must stay while
  `engine/yaml.mjs` bundles the parser.
- **`.github/` unlisted** — keep (example CI); also keep `.gitignore`/`.gitattributes`
  (hash normalization is load-bearing for the installer manifest).

## docs/ classification

Rules: KEEP = doctrine/install/release docs that stay true under the new arch
(product-quality standards are engine-independent); REWRITE = survives as a
concept but its command/architecture references are old-engine; DELETE = the doc
describes only dead machinery.

**KEEP (product doctrine + authoring + release):**
`architecture-rules.md`, `backend-source-pattern.md`, `portable-source-architecture.md`,
`design-pattern-catalog.md`, `design-pattern-source-review-20260916.md`,
`code-pattern-enforcement.md`, `business-srs.md`, `architecture-sds.md`,
`nest-boundary-check.md`, `nest-contract-check.md`, `nest-error-checks.md`,
`nest-error-identity-check.md`, `nest-syntax-checks.md`, `nest-test-code-check.md`,
`nest-test-discovery-check.md`, `next-data-lifecycle-check.md`,
`next-error-state-check.md`, `grammar-guard-checks.md`, `brand-checks.md`,
`verify-proof.md`, `browser-testing.md`, `application-stacks.md`,
`application-stacks-vps.md`, `application-runtime-config-and-health.md`,
`remote-application-api.md`, `knowledge-yaml.md`, `ops-source-ownership.md`,
`releasing.md` (trim `sites/` refs — dir is gone), `config-format.md` (if config
survives), `docs/examples/todo-app-standard.md` (example companion).

**REWRITE (concept survives, contents old-engine):**
`installation.md` (install flow is right; says "AGENTS.md and CLAUDE.md" while
installer writes three; `starci-5.0.0-plus.tgz` placeholder naming), `cli.md`
(shrinks to install verbs + `node scripts/*` invocation style), `architecture.md`
(ownership section survives; Plan/workflow sections old), `ledger-db.md`
(keystone — the sqlite contract survives via `engine/ledger-db`; strip old-engine
§references), `workflow-kernel.md` (181 KB of `kernel/`+`engine@1` internals —
replace with a short doc over `modules/kernel/*.yaml` + `api.mjs`, or delete and
let the yaml contracts speak), `source-layout.md`, `source-staleness.md`,
`architecture-check.md`, `architecture-input-scope.md` (all describe `starci
<cmd>` surfaces → re-point at `scripts/checks/`), `docs/examples/*` audit
case-by-case (`grit/`, `handoff/`, `v4-live-proof/`, `knowledge-update-delivery.md`
are point-in-time → `legacy/docs/` or delete).

**DELETE (old engine only):**
`5-plus.md` (85 KB release design), `v5-plan.md`, `execution-contract.md`,
`execution-agent-model.md`, `runtime-allocation.md`, `provider-observe.md`,
`kernel-guards.md`, `workflow-store.md`, `work-ledger.md`, `work-tree.md`,
`work-verification.md`, `op-granularity.md`, `model-catalog.md`,
`model-functions.md`, `solo-execution.md`, `scoped-approval.md`,
`scoped-evidence-publication.md`, `workflow-delivery-boundary.md`,
`delivery-review.md`, `standalone-workflow.md`, `workflow-chat.md` (the *skill*
`skills/workflow-chat/` may survive rewritten; the doc describes
`kernel/kernel.mjs`), `workflow-goals.md`, `orca-execution.md`, `migration.md`,
`source-of-trust.md` (doctrine is already inside SKILL.md keep-paragraphs;
standalone file is Work-tree-era), `skill-design.md` (describes the multi-file
skill packaging of old gens), `docs/supervision-templates/op.md` (old-kernel
prompt template, `kernel/kernel.mjs:4344`).

## Canonical target paths (kept items)

```
package.json          stays; bin→bin/starci.mjs (or scripts/install/install.mjs); files rewritten
SKILL.md              stays (rewrite per §6)
README.md             stays (rewrite §CLI/kernel/delivery sections)
LICENSE, THIRD_PARTY_NOTICES.md, .gitattributes, .gitignore, .github/   stay
config.example.yaml   stays (pending config decision, §5)
init/AGENTS.md        stays — single template, new wording; CLAUDE.md/DEVIN.md not stored
bin/starci.mjs        stays as install-only shim → scripts/install/install.mjs
bin/starci-skills.mjs → scripts/install/install.mjs
scripts/config/config.mjs → engine/config.mjs  (or DELETE with host config)
scripts/{goal,kernel,route,checks,example}/  stay
scripts/kernel/kernel-prompt.md  → modules/kernel/kernel-prompt.md (optional; data not code)
sqlite/schema.sql     → engine/ (per draft "schema-as-data")
docs/<keep-list>      stay; docs/examples/todo-app-standard.md stays
modules/kernel/*.yaml stay (kernel contract as data)
```

Deleted outright: `cli/`, `init/CLAUDE.md`, `init/DEVIN.md` (folded into one
template), `VERSION`, `README.yaml`, `INDEX.yaml`, `UPDATE.yaml`, `MASTER.md`,
`PARALLEL-AMAP.md`, `goal.md`, `scripts/work/`, `scripts/ledger/`, `docs/` delete
list above, `bin/`'s launcher/cli forwarding halves.

## Notes for sibling lanes

- `kernel/runtime-pin.mjs:37` RUNTIME_PAYLOAD_FILES lists root files
  (`INDEX.yaml README.yaml UPDATE.yaml config.json …`) — the seal list must be
  regenerated when root files are cut (kernel lane).
- `tests/engine-lifecycle.spec.mjs:49`, `tests/kernel-seams.spec.mjs:29`,
  `tests/skills-tree.spec.mjs`, `npm-package.spec.mjs`, `integration.spec.mjs`
  assert the install payload/init triple — test lane owns the rewrite.
- `hosts/orca/launch.mjs` usage block (:717-819) is the 4th command-surface
  copy; dies with `hosts/` (hosts lane).
- `docs/config-format.md` + `config.spec.mjs` pin the config schema — config
  decision (§5) unblocks both.
