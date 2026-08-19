# Sonar assurance machine

## LOADS

None.

## Record

This machine validates the Source-wide Sonar boundary for every routed `be`/backend, `fe`/frontend and
console row. It evaluates only structured evidence and never needs a live provider in tests.

## Rules

- A route inventory is incomplete until backend, frontend and console are all present and every row has a known role.
- The accepted analysis SHA and quality-gate status must be present; the SHA must equal the SHA requested for proof.
- Quality gates require OK; bugs, vulnerabilities and code smells are zero overall and new where the
  provider supports those measures; ratings are A; reviewed hotspots are 100%; duplicated density is
  at most 3 overall and new; native coverage is at least 80% overall and 90% new.
- On current SonarQube, `starci-strict` uses supported new-code conditions: zero new violations, three
  new-code A ratings, 100% new hotspots reviewed, new duplication at most 3% and new coverage at least
  90%. Authenticated proof remains separately blocking for every required overall/new measure; server
  condition limitations never erase overall coverage, findings, ratings, hotspots or duplication.
- Every routed project has one distinct project-analysis token. Admin/user tokens never scan source and
  one route never reuses another route's analysis identity.
- Every metric in the strict profile is required. An installation that cannot expose one is incomplete,
  never silently exempt.
- `SONAR_TOKEN` and `SONAR_ADMIN_TOKEN` are separate authorities. Tokens may enter only via
  environment or stdin and are never accepted as command-line values or printed.
- Plan and dry-run output contains project identities and actions only, never credential values.

## Output

The check returns `{ ok, failures, analysisSha }`; each failure includes metric, expected and actual
evidence. The quality-gate reconciler returns a value-free plan without network calls and performs API
reads/mutations only when execution is explicit. Execution discovers or creates fixed `starci-strict`,
reconciles only declared conditions (create/update/delete), associates every project, and sends Sonar
Web API form-urlencoded parameters.
Proof assembles status from `project_status`, all required measures from `measures/component`, and the
exact latest revision from `project_analyses/search`; absence of any required evidence fails.
