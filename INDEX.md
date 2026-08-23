---
title: Docs
---

# StarCi skills

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@assurance-be` | `compilers/patterns/be/delivery-assurance/context.md` | context | compile the complete backend hook, CI, coverage, analysis, secret and deploy fence |
| `@brainstorms` | `brainstorms/context.md` | context | challenge a design and expose only materially useful alternatives before a shape is accepted |
| `@frontend-quality` | `brainstorms/frontend-quality/context.md` | context | challenge one frontend direction through integrated craft, UX, accessibility, engineering and detector lenses |
| `@business` | `contexts/business/context.md` | context | resolve evidence-backed actors, flows, rules, states, operations and prototype surfaces |
| `@canon-be` | `@starci/eslint-canon-be` | npm package | the published backend machine this record cites |
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | the published frontend machine this record cites |
| `@compilers` | `compilers/context.md` | context | compile an accepted shape into one answer |
| `@conversations` | `contexts/conversations/context.md` | context | bind provider-neutral chat provenance to exact FE/BE artifact hashes without storing raw transcripts in Git |
| `@contexts` | `contexts/context.md` | context | resolve where reads and writes occur |
| `@deployment` | `deployment/context.md` | context | govern portable stack intent, ignored execution state, host setup, domains, release and monitoring |
| `@contract-search` | `scripts/contract-search.mjs` | script | resolve contract entries by their stated need |
| `@design-review` | `publication/design-review-preview/context.md` | context | write static HTML layout/block review files directly under project cache |
| `@eslint-repo` | `https://github.com/starci183/starci-eslint` | URL | identify the repository that publishes the lint machines |
| `@gates` | `gates/context.md` | context | judge existing code with evidence |
| `@grammars` | `grammars/context.md` | context | load explicitly selected product-family UI facts, outcomes, owners and durable behavior authority |
| `@initialization` | `readiness/initialization/context.md` | context | establish identity, bootstrap, workspace routes and worktree state from one readiness contract |
| `@kernel` | `kernel/context.md` | context | resolve route, state, approval identity and evidence before role law |
| `@machines` | `machines/context.md` | context | locate deterministic dependency, parity, quality, artifact and secret machines |
| `@mcp` | `mcp/context.md` | context | build and expose routed source context through isolated read-only MCP services |
| `@operations` | `operations/context.md` | context | route deployment, MCP, readiness and operator procedures without merging their outputs |
| `@orchestration` | `orchestration/context.md` | context | map coordinator decisions and bounded worker execution across Claude and Codex |
| `@patterns` | `compilers/patterns/context.md` | context | resolve files and import boundaries |
| `@port-offset-check` | `scripts/check-port-offsets.mjs` | script | prove Source family offsets, application slots, projections and local listener uniqueness |
| `@principles` | `compilers/principles/context.md` | context | resolve classes from accepted situations |
| `@publication` | `publication/context.md` | context | separate runtime authority from generated human documentation |
| `@skill-shape` | `skills/skill-shape/context.md` | context | load the shared reporting contract when a skill runs |
| `@skills` | `skills/context.md` | context | locate the capability registry |
| `@standards` | `standards/context.md` | context | route role patterns, gates, rule bindings and assurance from one stable entry |
| `@staleness` | `readiness/staleness/context.md` | context | share one stale taxonomy and category modules between inventory and repair |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate and hash candidate artifacts |
| `@workflows` | `workflows/context.md` | context | group discoverable skills by source, backend, frontend, quality and operations lifecycle |
| `@workspaces` | `contexts/workspaces/context.md` | context | resolve Source-wide defaults and verify role routes |
| `@worktrees` | `contexts/worktrees/context.md` | context | resolve durable write roots |


## Record

Read this before planning, before reading target source, and before running a skill.

The tree is split by **what a stage is allowed to return**. That is the only classification here;
order follows from it rather than defining it.

| Tree | Returns | Read it when |
|---|---|---|
| `@contexts` | where source is read from, where state is written | always first — nothing below is correct if the route is wrong |
| `@grammars` | deterministic product-family facts, outcomes, owners and durable behavior | a verified workspace route explicitly selects a grammar/profile |
| `@brainstorms` | one complete generated baseline, or 3–4 targeted alternatives only after an explicit owner brainstorm request | a complete baseline or requested variation is not yet decided |
| `@compilers` | exactly one answer, no candidates | an accepted shape needs execution detail — `@principles` decide classes and `@patterns` decide files/imports |
| `@gates` | pass, or reject with evidence | code exists and must be judged — `@gates` point at the character they refuse on |

Frontend work first classifies observable impact: `micro` uses a plain exact edit, `component` uses Block,
`page` uses Layout/Refactor, and `capability` or `cross-domain` adds independent challenge. Do not force the
full design workflow onto label, icon, token, spacing or other exact corrections that preserve anatomy and ownership.
User-facing progress uses Scope, Decision, Source boundary, Test evidence, Approval and Result; internal methodology
names remain debug detail.

Frontend layout generation starts top-down from customer journey plus routed business truth and bottom-up from
component, contract plus source capability. Their explicit intersection produces one functional,
business-faithful complete long page or flow by default. Page anatomy is rendered first at representative
desktop/narrow states and receives cache-only `OK #1`; only then are all evidenced conditions expanded under the
unchanged direction-plus-page hash. `OK #2` binds complete states and exact source files before implementation. One
direction is rendered by default and 3–4 alternatives appear only after an explicit owner brainstorm request
before direction approval. Layout prints journey and UI direction separately; Refactor and Block print UI
direction only. The QA viewer may
inspect states but may not substitute for product interaction.

Every physical skill uses `manual` approval by default and supports exact `mode=auto`. Auto binds to the immutable
invocation envelope and advances only through declared checkpoints whose normal contracts and gates pass. It never
approves scope expansion, credentials, destructive work or external publication; read-only and no-write skills do
not manufacture a source approval merely to advance.

Before alternatives, frontend work locks `Scope`, `Owner`, `Invariant` and `Proof` from legacy/current evidence,
then applies one routed StarCi MASTER visual system. Every candidate passes the shared `@frontend-quality` review:
external taste/catalogue/guideline sources stay digest-bound advisory evidence while product fit, visual character,
design-system fit, accessibility, interaction, responsive content, performance/motion, component composition,
state resilience and copy/localization resolve to StarCi owners and detector proof. Profiles override declared roles
only, pages record deviations only, grammar selects semantic owners, and principles resolve visual deltas left
unanswered by those authorities.

Three workers is a runtime-capacity ceiling, not a claimed optimum. Five visual views is a default human-review
budget, not state coverage. Visual verdicts are computed from actual PNG, normalized DOM, axe and Playwright-trace
evidence with per-reference thresholds. Complete internal run records reject unused artifacts and measure time,
available tokens, decision-changing approvals, defects caught, false-positive gates and coordinator rework.

## V4 authority route

The stage trees above remain the one homes of detailed law. V4 adds stable cross-stage routers; it does
not copy those laws:

```text
@kernel
  → @workflows
  → @orchestration through the selected skill's machine-validated phase map
  → @standards
  → approved source write
  → @gates
  → @machines
  → @operations when the request reaches runtime/provider state
  → @publication for human rendering only
```

`@standards` holds the accountability chain `pattern situation → gate situation → published machine
identity → executable proof`. `@workflows` keeps every physical `SKILL.md` under `.claude/skills` so
Claude and Codex discovery remain intact. A new router is valid only when it points to the existing
authority and adds no second ruling.

## Load order

**A skill owns its own reading list.** Its numbered steps name what to read and when. If a skill is
driving, follow the skill and stop reading here — this file has done its job by getting you to it, and
loading a stage the skill did not ask for is paying for a tree you are not using.

**If nothing is driving — plain coding, no skill —** this order is yours:

1. `@workspaces` — resolve the project's role routes and **verify**
   them. A stale route stops the work; it is not approximated.
2. `@business` — classify `businessImpact`. Business-affecting work requires the exact feature head at
   `in-progress`; technical-only work declares `none` and binds current `implemented` truth. `pending` and
   `rejected` are read-only for product source.
3. `@worktrees` — only if the work writes state that must survive.
4. `@grammars`, then `@compilers` — resolve the explicitly routed product grammar first. Before the first
   source line, use `@principles` for every class and `@patterns` for which file holds the code and what it may import.
   Both answer a shape already accepted, so reading them afterwards leaves only one move — moving code
   that is already written.
5. `@gates` — last, on code that exists. Business-affecting work closes only after final committed source
   is reconciled to an `implemented` business head.

`@brainstorms` is deliberately absent from that list: if the shape is not decided,
coding has not started, and deciding it belongs to a skill — direction inside layout, then block.

Read `@skill-shape` when you are about to run a skill or write one, not
before every task.

A request that cannot resolve its project, its role targets or its write boundary is stuck before any
target-specific work. Say so; do not proceed on a guess.

## Capabilities

Eighteen. `@skills` holds them; `@skill-shape` holds what they must all print, ask and
record. `@orchestration` covers all physical skills through one machine registry; it is policy, not another capability,
and coverage does not force delegation when sequential execution is safer or cheaper.

| Skill | Owns |
|---|---|
| `starci-business-analyze` | evidence-backed FE+BE business feature heads, modular LLM context and prototype-ready surfaces |
| `starci-init` | making a Source ready: SOPS+age identity, bootstrap, `.workspace/<project>/`, and `.worktrees/<project>/` |
| `starci-cloudflare-tunnel-set` | the Source-wide multi-project Cloudflare control plane: API custody in `.workspace/credentials` and declared HTTP(S) tunnel/DNS routes |
| `starci-deploy` | adopting, setting up, deploying, monitoring, recovering and rolling back a routed product from durable `.stacks` intent through ignored `.infra` execution state |
| `starci-setup-mcp` | one Source-wide read-only source-context MCP, routed project partitions, and approved `mcp.<zone>` publication |
| `starci-setup-sonar` | one shared Docker SonarQube service, project onboarding, and approved `sonar.<zone>` publication |
| `starci-stale-list` | every read-only stale fact across routes, port allocation, gates, contracts, lint/formatter adoption, delivery assurance, structure and remnants, with who clears each |
| `starci-diagnose` | a read-only trace of another skill; writes nothing it traces |
| `starci-repair` | a red or incompletely assured source returned green — Source-owned port allocation, separated passes, complete frontend or backend delivery fence, never suppression or plaintext secrets |
| `starci-debt-repay` | repaying accepted Source debt, recording measured progress and removing only scopes whose exit criteria pass |
| `starci-fe-design-layout` | mandatory journey-plus-UI direction synthesis into complete pages; one direction by default or 3–4 on explicit brainstorm, then staged source/seed implementation and proof |
| `starci-fe-layout-refactor` | proportional correction for exact Layout/Block-rendered output; feedback triggers investigation and durable authority evolves only with systemic evidence |
| `starci-fe-ui-reconcile` | cross-surface UI consistency reconciliation; separates local drift from systemic grammar/principle gaps, then aligns and proves the approved impact cone |
| `starci-fe-design-block` | component-impact correction in its complete parent; direction only for an unresolved UI decision, then one bounded source approval and proof |
| `starci-grammar-refresh-references` | audit and repair stale optional immutable grammar provenance without changing durable authority |
| `starci-conversation-record` | provider-neutral conversation snapshots, artifact provenance links and redacted/encrypted transcript custody |
| `starci-be-plan` | the backend brief |
| `starci-be-approve` | approval, then backend source |

## What this tree refuses

The rules here are written to be **machine-refusable**, because a rule that only advises gets skipped
under pressure:

- a layout candidate is class-free, enforced by
  `@contract-search`, which returns a contract entry's `key`,
  `why` and `host` and never extracts its classes — a stage that cannot see a class cannot write one, and
  the value not arriving is what holds that, not a rule asking a reader to skip a field;
- a direction batch is vocabulary-bound and MASTER-constrained; candidate hashes are session cache keys,
  while frontend source and proof are the durable result;
- every schema sets `additionalProperties: false`, so a stray `className` is invalid rather than
  arguable;
- `@validate-artifact` refuses a batch whose candidates share an axis set; current source and legacy are
  precedent evidence, not a separately persisted design corpus;
- the lint machines are real ESLint plugins, published from `@eslint-repo` as
  `@canon-fe` and `@canon-be`, each rule shipped with the test that fires it.
  **This tree is the law; that repository is the machine.** A rule there with no law here is
  unaccountable; a law here with no rule there only advises;
- layout page approval binds only the canonical cache page contract; its second approval binds complete states plus exact source files for the same invocation.

## Authoring

Every module has two human records and one runtime record. `en.md` is the complete English reference,
`vi.md` is the complete Vietnamese reference, and derived `context.md` is the sole module record an
agent loads. The human records match section for section and neither is an alternate runtime law. A
shelf may carry the same three records, with its `context.md` acting as the runtime router.

Every capability follows the same publication rule without changing the runtime contract: `SKILL.md`
remains the binding agent entry, while `en.md` and `vi.md` beside it are the complete English and
Vietnamese records for human readers. All three publish under the capability's own route; agents still
load only `SKILL.md`.

**A running skill loads runtime records only:** its binding `SKILL.md`, then `context.md` for every
paired module it needs. It never loads `en.md` or `vi.md`; both are human-facing publication, not
alternate instruction sources. `context.md` is derived from `en.md` and contains runtime law only;
source hashes and schema versions live out of band in `context-manifest.json`. It may be curated for
compactness as long as binding sections and situation identities remain covered. Use the compiler to
write a safe baseline, refresh the manifest after an intentional curation, and check the
contract whenever either record changes.

Dependency validation is three separate graphs. Runtime `context.md`, binding `SKILL.md`, and this
index may load internal `context` targets only. English publication records load `en` targets;
Vietnamese publication records load `vi` targets. A human publication shelf may use `module` only
when it has no shelf record and the selected language exists below it. Run `check-deps.mjs --context`,
`--en`, and `--vi` independently, or `--all` for the three verdicts together.

**One tier, two layouts.** A frontend is either **single-app**, keeping the component tree at
`src/components/*`, or a **monorepo**, keeping the same tree under the same tier names in a shared
package at `packages/ui/src/*`. The tier names never change; only the prefix does, and the prefix is a
closed list the machine holds — `src/components`, `packages/ui/src`, `src`.

So a rule writes the tier and not the prefix: `components/leaves/<Name>/index.tsx`. A rule that writes
the prefix by hand works in one repository and is **blind in the other** — and blind here is not noisy,
it is silently wrong in both directions at once: an unrecognised leaf gets reported for writing the
classes a leaf is supposed to write, while every rule guarding the leaf tier quietly stops guarding
anything. Measured once, pointed at a monorepo: 46 errors across 28 correct files, and the repository
owed none of them.

The machine does this without branching per layout, and the shape is worth copying: a predicate walks
the closed list and passes if **any** root matches; a path builder maps the list and emits **one
candidate per layout**; a resource that can be split — a theme stylesheet in a monorepo — has its own
candidate list, and every file found is read and joined rather than the first one winning. So a layout
added to the list is added to every rule at once, which is the whole reason there is one list instead
of an `if` per rule.

A monorepo also carries one law a single-app tree cannot have — `FILE-5`: a tier that knows a feature
belongs to the app that owns the feature, a tier that knows none belongs to the shared package. In a
single-app checkout that rule is **inert by its own regex**, which requires an `apps/<name>/src/` or
`packages/<name>/src/` segment — not disabled by configuration, so nobody has to remember to turn it
off and nobody can turn it on wrongly.

The exception is a rule describing **its own machine**: when a lint gates on a filename containing
`/src/tests/`, that string is the mechanism, not a layout claim, and it is quoted exactly.

**A law names a rule, never a rule's file.** The published rule name is the only identifier —
`@canon-fe` and `@canon-be` are where the implementations live, and how they
are arranged into files is the machine's business, not the law's.

Rules live in the tree. This file routes; it never restates a rule, and neither does the Source
bootstrap.
