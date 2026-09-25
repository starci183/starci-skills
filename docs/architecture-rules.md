# Common architecture rules

These are the shared rules for StarCi projects: TypeScript, Next.js frontend and NestJS backend, using the owner's Academy code patterns and enterprise design obligations. This is a fixed technology family, not a framework-selection system. The rules fix responsibilities, dependency direction, authority, state and effect invariants. Nest/Next profiles supply concrete paths and code forms; repository topology supplies build/source mappings. Neither an example nor a historical reference file count can add a mandatory layer.

## Authority and load order

1. Read `knowledge/architecture-rules.yaml`: the common invariants and their applicability.
2. Read `knowledge/coding-reference.yaml`: resolve the applicable Nest/Next profile and actual installed versions/APIs.
3. Read only the relevant FE/BE topics and the [portable source profile](portable-source-architecture.md). The [backend profile](backend-source-pattern.md) specializes these rules for Nest/TypeScript.
4. Resolve actual repository roots, manifests, aliases, exports and source/Work bindings. Record the selected profile/mapping in the existing design or implementation brief; no new approval ceremony or duplicate checklist is required.
5. Run every applicable code-pattern script and the behavioral verification required by the selected effects. Code-rule coverage must be complete for a code-conformance pass. Missing/disabled/unavailable checkers are failures of coverage; an agent cannot substitute visual review for a required code check. Agents use the design guidance to review semantic choices and edge cases, retaining required executable behavior evidence.

The executable inventory is `modules/models/code-patterns.yaml`, described in [code-pattern enforcement](code-pattern-enforcement.md). The [design catalog](design-pattern-catalog.md) supplies conditional semantic decisions and failure cases. The common-rule mappings below point to applicable checks; they do not replace the profile's complete inventory or make a missing checker pass.

User authority and accepted product SRS/SDS retain their own roles. Common rules do not invent product requirements. A project incompatibility is a concrete design/profile conflict to resolve under current authority, not permission to weaken a checker or silently change requirements. A profile may specialize a rule; it may not reverse an invariant. Runtime installation does not modify existing source, Work, approvals or evidence.

## Mandatory invariants

Each rule's invariant is its `requirement` in `knowledge/architecture-rules.yaml`; this table adds the review question.

| Rule | Concrete review question |
| --- | --- |
| ARCH-OWNERSHIP | Where is the change made, and which consumers depend on it? |
| ARCH-COMPOSITION | Is this startup wiring or a business decision disguised as configuration? |
| ARCH-DEPENDENCY | Can the capability function without importing its caller? |
| ARCH-PUBLIC-API | Is the consumer coupled to a private file, raw state or duplicate provider registration? |
| ARCH-ABSTRACTION | What behavior would become unclear if this wrapper were removed? |
| ARCH-DATA-BOUNDARY | Did a wire DTO, entity or SDK object become an internal/public contract by accident? |
| ARCH-STATE | Who decides truth, and how do caches/read models recover or expose lag? |
| ARCH-IDENTITY | Is a global or cached instance being used across incompatible scopes? |
| ARCH-CONFIG | Can the process start work with missing authority, malformed endpoints or leaked secrets? |
| ARCH-AUTHORITY | Can another transport, job or internal entry bypass the policy? |
| ARCH-EFFECT | What happens if it succeeds remotely but the caller loses the acknowledgement? |
| ARCH-CONCURRENCY | Is a pre-read mistaken for atomic exclusion or idempotency? |
| ARCH-OPERABILITY | Does dependency failure cause controlled degradation or blind restart/retry loops? |
| ARCH-EVIDENCE | What did the check actually execute and which input revision did it cover? |
| ARCH-WORK | Was source observation promoted into an accepted requirement, or old proof relabeled current? |
| ARCH-DEPLOYMENT | Is API access being confused with application rollout or infrastructure administration? |

These obligations scale with the actual scope. A pure formatter does not need a saga, a deployment manifest or a database harness. A local transaction does need a demonstrable atomic boundary. A public API needs an owned protocol and authority contract even if its source is small.

## Conditional mechanisms, not a mandatory technology list

| Trigger | Required property | Possible mechanism; not compulsory by name |
| --- | --- | --- |
| A local commit must lead to a durable external notification | No silent lost publication; duplicates have defined handling | Transactional outbox and consumer deduplication |
| A scenario crosses independent transactions/systems | Durable progress, unknown-effect handling and recovery | Persisted process manager/saga |
| A replaced worker can still access a resource | Obsolete execution cannot silently commit a new effect | Resource-enforced fencing; provider idempotency/reconciliation where fencing is unavailable |
| Concurrent requests compete over an invariant | Atomic enforcement and specified conflict behavior | Unique constraint, compare-and-set, lock or equivalent |
| Dispatch/read/write separation has actual semantics | One execution owner and a clear consistency contract | CQRS/command bus or a direct typed use case |
| A capability has caller-specific configuration or instance identity | Typed validated registration and correct lifetime | Dynamic module, factory or explicit dependency composition |
| UI data/lifecycle and rendering have distinct useful contracts | One state owner and explicit render inputs/actions | Connected/presentational split |
| Code has independent ownership/distribution lifecycle | A stable public contract and verified dependency boundary | Shared package |

The owning design records the trigger and invariant, then chooses the smallest mechanism that satisfies them. Do not generate all mechanisms in every project. Do not select a weaker mechanism merely because its narrow unit test is easier to pass.

## Fixed stack and repository profiles

Every project in this standard uses Next.js and NestJS. Backend composition maps to the real Nest `main.ts`/`app.module.ts` boundaries; frontend composition maps to Next route/layout/provider boundaries. Single-source and monorepo layouts share these rules. Agents do not substitute another framework or a generic architecture dialect merely because it can satisfy a weaker check.

Similarly:

- DTO ownership and runtime validation are common rules; the Nest/Next profile uses the owner's concrete code forms and installed validator APIs.
- A configuration/lifetime contract is common; use the adopted Nest static/dynamic module rule rather than inventing another registration architecture.
- Transaction/connection identity is common; TypeORM-owning code follows Academy named EntityManager injection and its executable rules. Any purposeful boundary abstraction must preserve that identity and must not bypass the pattern.
- Frontend composition follows the owner's patterns and verified Grammar public APIs. Never invent package exports or component props.
- A monorepo package and a separate source repository preserve the same owner graph. Paths, build tools and package managers are discovered/configured rather than assumed.

Existing historical Academy topics remain useful only within their stated profile. Current common rules and adopted boundary rules take precedence over historical wrapper, global-registration, deep-import or test-shape examples. A conflicting installed lint rule must be updated coherently within authorized scope; turning it off to claim conformance is not an update.

## Rule authoring and enforcement contract

Each normative rule needs a stable ID, applicability, a requirement, its invariant/rationale, and verifiable outcomes. Classify mechanically decidable code obligations separately from semantic design obligations. Code obligations require executable scripts with complete applicable rule/file coverage; design patterns and edge cases are documented in Markdown and reviewed by an agent. A rule containing both must separate the obligations rather than let manual review waive its code half. Use conditional cases where a trigger matters, name actual checks and state limits plus the authorized correction route. A title, example file or historical frequency alone is not a rule.

The current knowledge format uses `appliesTo`, `requirement`, `rationale`, `cases` and `verification.automated/manual`; companion guidance records scope and limits. An empty automated list is appropriate for a semantic design invariant, but a mechanical code rule with no executable checker is an enforcement gap that blocks code-pattern conformance. Never relabel a missing code check as design to claim complete coverage. Complete code-rule coverage does not mean detection of every possible semantic bug.

| Evidence channel | Can establish | Cannot establish alone |
| --- | --- | --- |
| Architecture/static lint | Supported resolved dependency edges, source roles, package exports and specific syntax boundaries | Cohesive ownership, complete authorization, correct DI or effects |
| Work/source freshness scripts | Whether declared input/source/evidence identities still agree; missing/unverifiable coverage | That absent proof means absent code, or current code meets behavior |
| Stack static validation | Consistency of declared components, placements, source/config/custody references | Live authentication, health, rollout or recovery |
| Behavioral verification | The exercised boot, contract, concurrency or recovery invariant under recorded conditions | Unexercised paths or unrelated deployment environments |
| Design review | Responsibility, tradeoffs and uncovered obligations | Executed runtime behavior |

Do not add ignores, suppressions, relaxed thresholds, fabricated metadata or stale hashes to manufacture a pass. Unsupported syntax and unavailable tools block required code coverage. A different framework is outside this standard and needs an explicit scope/standard change, not automatic substitution. Use AST/type resolution when syntax checks depend on binding; an identifier's spelling alone is not identity.

## Work and deployment consequences

`.starciwork` has one canonical project owner. SRS owns behavior; SDS owns target design; implementation and UAT bind real source/results. Shared contracts have one owner and stable references. Create nodes for independently meaningful scope/ownership/verification, not each source file. Keep execution state under the declared local runtime area. A changed input invalidates affected proof without destroying valid unrelated history.

`.starcistacks` owns application deployment declarations. Each selected component binds source/image, configuration and secret references, placement, dependencies, health and lifecycle verification. Host, container and remote application API placements remain distinct. API consumption does not grant application deployment or cluster administration. Declaration validation and live proof remain separate results.

Read-only `stales`/`lint` audits measure inputs, including unfinished or stale subjects. They do not change inspected Work/source or authorize repair. A completed measurement may contain findings; a delivery gate passes only with its required clean/current coverage. Findings route to the separately authorized owner, followed by fresh checks and evidence. Restart resumes valid checkpoints rather than rebuilding unrelated work from zero.

## Research status

These are adopted rules shared by the owner's Nest/Next projects, not a claim that one directory tree is an industry standard. The concrete profiles document read-only Academy FE/BE observations, primary framework sources, rejected historical debt and verification limits. Sources are evidence for a decision, not instructions that override user authority or accepted product intent.
