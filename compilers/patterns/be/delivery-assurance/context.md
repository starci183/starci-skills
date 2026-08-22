# Delivery assurance

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | supplies the check-only backend lint machine the delivery gates invoke |

## Record

The input is a backend repository whose source and test lanes already exist. The output is the delivery
machine around them: fast local refusal, reproducible CI, coverage evidence, static analysis, secret
custody, merge enforcement and a deploy that cannot outrun verification.

## Law

**A green command is not assurance until a boundary refuses on it.** Husky gives fast feedback but can be
bypassed. CI reruns the repository's own check-only commands. Required checks make those results a merge
condition. Deployment begins only after that condition has passed.

Backend repositories require the complete machine by default. Partial adoption is stale, not a smaller profile:
Codecov without coverage uploads nothing useful; SonarQube without a quality gate only comments; a CI job
without branch protection advises; a deploy that races CI can publish red source.

A project may explicitly declare that delivery assurance is not required. The declaration lives in the
tracked manifest, never in a machine-local workspace route, so every reader sees the same owner decision.
Only `starci.deliveryAssurance.required: false` with a non-empty `reason` is an exemption. Absence, a typo,
or `false` without a reason means assurance is still required; a repository cannot become exempt merely by
being incomplete.

Third-party credentials have two homes with different consumers. The encrypted source record lives under
`.stacks/dev/runtime/files/`; GitHub Actions receives an external secret projection because CI deliberately
does not hold the SOPS master identity. Neither home licenses plaintext in source, workflow arguments,
terminal output or chat.

The Source helper `scripts/publish-secret.mjs` is the standard bridge between those homes. It prints a
value-free plan, reads an existing process environment variable by name or opens a hidden prompt, feeds the
value to the repository `secret:set` entrypoint and `gh secret set` over stdin, then clears its process
environment copy. A repository-scoped provider token targets one repository; batching repositories requires
a provider credential whose scope actually covers every named repository.

## Applicability

Read `package.json` before evaluating any `ASSURANCE-*` situation:

```json
{
  "starci": {
    "deliveryAssurance": {
      "required": false,
      "reason": "Owner-approved reason this project does not require delivery assurance."
    }
  }
}
```

- No declaration, or `required: true` → `required`; evaluate all reached situations.
- Exact `required: false` plus a non-empty `reason` → `not required`; report the reason and do not install,
  measure or request any assurance service.
- `required: false` without a non-empty reason → invalid exemption; report it as stale manifest policy and
  keep assurance required.

## Situation codes

| Code | Situation | What the repository must contain |
|---|---|---|
| `ASSURANCE-1` | A developer is about to push | Husky is installed; `pre-push` runs full check-only lint and the fast unit lane, and exits on either failure |
| `ASSURANCE-2` | A pull request is opened or updated | An active PR workflow installs from the lockfile and runs zero-warning check-only lint, typecheck/build, mature unit coverage and every declared E2E suite; no CI command fixes source, skips a suite or accepts an empty lane |
| `ASSURANCE-3` | Unit tests ran in CI | One run emits LCOV, independently clears statements, functions and lines at 80% plus branches at 75%, enforces 90% on new-code/patch for all four metrics, uploads through Codecov, exposes blocking patch/project statuses, and README links a reachable safe Codecov badge |
| `ASSURANCE-4` | The same revision needs quality and security analysis | A local authenticated scan of the exact checkout consumes the LCOV, proves the strict Sonar profile and waits for `OK` before CI; SonarQube CI repeats that blocking gate and README exposes the full safe metric set |
| `ASSURANCE-5` | Codecov or SonarQube needs a credential | `codecov-token.key.enc` and `sonarqube-token.key.enc` exist under `.stacks/dev/runtime/files/`; workflows reference named GitHub secrets and never decrypt stacks |
| `ASSURANCE-6` | A pull request is ready to merge | GitHub branch protection or a ruleset requires CI, Codecov and SonarQube checks from their expected apps |
| `ASSURANCE-7` | A deploy workflow exists | Deployment depends on successful verification through `needs`, a reusable workflow, or a successful workflow-run trigger |

## Reading an accepted shape

1. Read the manifest and preserve the repository's package manager and gate names. Add a missing
   check-only alias; never point a hook or CI at an autofix command.
2. Keep pre-push intentionally fast: full lint plus unit tests. Typecheck/build stay in CI; repair also runs
   coverage and authenticated local analysis before CI is trusted.
3. Generate one LCOV report and feed the same evidence to Codecov and SonarQube. Two test executions for
   two dashboards are drift, not stronger assurance.
4. Treat service creation, GitHub secrets, repository variables and branch rules as external mutations.
   They require approval and access, but missing access leaves an explicit incomplete boundary rather than
   silently deleting the check.
5. Never ask for a token in conversation. Use the repository's hidden-input stack-secret entrypoint or an
   already-authorized secret provider; publish to GitHub Secrets without printing or placing values in a
   command-line argument.

## Blocking quality profile

The complete profile is mandatory for every routed source; it has no informational mode:

- lint finishes with zero errors and zero warnings;
- one successful unit run produces `coverage/lcov.info` and independently proves statements, functions
  and lines at least 80%, branches at least 75%, and new-code/patch coverage at least 90% for each metric;
- every declared E2E entrypoint exists, discovers real tests and passes without `skip`, `todo`,
  `passWithNoTests`, a zero-test success or a cheaper substitute;
- Sonar analyses the exact checkout revision, reports Quality Gate `OK`, bugs, vulnerabilities and code
  smells equal to zero, security hotspots reviewed 100%, maintainability/reliability/security rating A,
  duplicated-lines density no more than 3% overall and on new code, native coverage at least 80% overall
  and 90% on new code.

Jest owns the four distinct coverage metrics. Codecov and Sonar consume the same LCOV and gate only the
native project/new coverage metrics they actually expose; neither may be described as independently proving
Jest statements, functions or branches. A badge, an uploaded analysis, `NONE`, a stale revision or an unmeasured provider
value is not proof.

## Lane separation

Unit is the sole coverage-producing lane. E2E is a separate behavioral refusal and never contributes to,
merges with or rewrites the LCOV consumed by Sonar. CI may order unit, E2E and Sonar, but it records their
verdicts independently: E2E pass is not Sonar evidence, Sonar pass is not E2E evidence, and neither failure
is renamed as the other.

## The seven refusals

`ASSURANCE-1` is local latency, not authority. It requires `.husky/pre-push` to call the manifest's
`lint:check` and `test:ci` or `test:unit` entrypoints. `--no-verify` is why code 6 still exists.

`ASSURANCE-2` is reproducibility. The PR trigger is active, dependencies come from the lockfile, and the
workflow calls repository scripts. A commented trigger or a manual-only workflow is not CI adoption.

`ASSURANCE-3` owns coverage movement. Unit CI emits `coverage/lcov.info`; Codecov uploads that exact file
and its patch/project statuses are intended to block. README exposes the repository's real Codecov badge;
the image URL is reachable and uses no credential except a provider-issued, project-scoped read-only badge
token required for a private project. That token is confined to the official image endpoint and grants no
upload or API authority. Coverage percentage belongs to the service policy,
not a second Jest invocation.

`ASSURANCE-4` owns analysis. Repair first scans the current local checkout with
`sonar.qualitygate.wait=true`; a red gate is repaired in source and scanned again before CI. SonarQube CI
consumes the same revision and LCOV report. Scan success and quality gate success are different facts; the workflow must wait for or receive the gate result. README exposes
reachable badges for quality gate, coverage, bugs, vulnerabilities, code smells, maintainability,
reliability and security for the same project key. Public badges are token-free; private badges may use
only the same provider-issued read-only badge capability and never a scan, API or admin credential.

`ASSURANCE-5` owns custody. The stack keeps encrypted provider tokens by fixed names. GitHub Secrets are
the CI projection, `SONAR_HOST_URL` is a repository variable unless the installation treats it as secret,
and no workflow attempts to decrypt `.stacks`.

`ASSURANCE-6` is the external fence. A green workflow file on disk cannot prove a GitHub ruleset exists,
so local scans report this code as unmeasured until the GitHub API or UI supplies evidence.

`ASSURANCE-7` closes the last race. A push-to-main deploy with no dependency on verification can publish a
revision while its checks are red; paths-ignore never substitutes for a dependency.

## Layer held

| Code | Tier | What holds it |
|---|---|---|
| `ASSURANCE-1` | `enforced` | Husky `pre-push` and non-zero script exits |
| `ASSURANCE-2` | `enforced` | active CI workflow over repository scripts |
| `ASSURANCE-3` | `enforced` | LCOV generation, Codecov upload and required Codecov statuses |
| `ASSURANCE-4` | `enforced` | SonarQube scan plus quality-gate result |
| `ASSURANCE-5` | `enforced` | encrypted stack records plus symbolic GitHub secret references |
| `ASSURANCE-6` | `external` | GitHub branch protection or ruleset; filesystem inspection cannot prove it |
| `ASSURANCE-7` | `enforced` | deploy workflow dependency graph |

## Inputs

| Input | Evidence required |
|---|---|
| manifest | package manager, check-only lint, unit, typecheck/build and coverage scripts |
| hooks | tracked Husky hook content |
| CI | active workflow triggers, commands and dependency graph |
| coverage | one LCOV path consumed by Codecov and SonarQube; safe reachable README badges for both |
| secrets | encrypted stack filenames and symbolic workflow references, never values |
| external enforcement | GitHub API/UI evidence for required checks and expected apps |

## Rules

1. Backend assurance is required by default; only the tracked manifest declaration in Applicability can exempt it.
2. Hooks and CI invoke check-only commands and never mutate source; readiness requires zero lint warnings.
3. Local pre-push stays at lint plus unit; repair runs local coverage and waited Sonar analysis separately.
4. Codecov and SonarQube consume the same LCOV report from the same successful mature-threshold unit run, and README exposes
   reachable safe badges for both provider results.
5. Provider tokens are encrypted in stacks and projected to GitHub Secrets without plaintext transit through source or chat.
6. A green local Sonar scan never claims branch protection is configured without external evidence.
7. A deploy cannot begin before verification passes.
8. Unit is the sole LCOV producer; E2E is an independent behavioral lane excluded from Sonar analysis and
   coverage, and never substitutes for a Sonar verdict.

## Exceptions

- A valid `starci.deliveryAssurance.required: false` declaration makes the whole assurance pattern not
  required for that project. It is not partial adoption, and `starci-repair` must not install any part.
- A backend repository with no deploy workflow does not reach `ASSURANCE-7`; it does not create a dummy deploy.
- A temporary provider outage may leave a required check unavailable, but it never removes or marks the check optional.
- A provider supporting approved tokenless identity may replace the corresponding GitHub secret projection; the encrypted owner record remains unless the owner explicitly retires that credential.

## Output

```text
repository: <resolved backend checkout>
local: <Husky pre-push entrypoints>
ci: <check-only gates and active trigger>
coverage: <LCOV producer and Codecov consumer>
analysis: <SonarQube scan and quality gate>
secrets: <encrypted stack record names and symbolic CI references>
merge: <required checks evidence | unmeasured external>
deploy: <verification dependency | not applicable>
safety: <zero-warning lint, mature unit metrics, full E2E and exact-SHA strict Sonar proof>
situations: <ASSURANCE-1 ... ASSURANCE-7 reached by this repository>
verdict: <complete | stale | needs external authority | not required>
reason: <required only when verdict is not required>
```
