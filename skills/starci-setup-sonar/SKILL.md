---
name: starci-setup-sonar
description: Set up the shared Docker SonarQube service for routed StarCi projects and publish its Sonar hostname through the shared Cloudflare control plane. Use for first-machine SonarQube setup, recovery, public DNS, or onboarding another project to the shared scanner.
---

# starci-setup-sonar

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape` | module | shared approval and output contract |
| `@workspaces` | `contexts/workspaces` | module | resolve the backend owner and target projects |
| `@assurance-be` | `compilers/patterns/be/delivery-assurance` | module | scanner, token, coverage and quality-gate contract |
| `@tunnel-set` | `scripts/cloudflare-tunnel-set.mjs` | script | value-safe tunnel and DNS reconciliation |

## NESTED SKILLS

None.

## Run

Read `@skill-shape`, `@workspaces` and `@assurance-be`. Resolve the verified route that owns the shared StarCi stack files, but run SonarQube, PostgreSQL, bootstrap
and connector under the separate Docker Compose project `starci`, never under a product Compose group. Use
the declared `compose:starci` command and reuse the existing shared service; do not create one SonarQube per
project. Onboard projects with distinct `sonar.projectKey` values and their own CI `SONAR_TOKEN`; coverage
must come from the same measured unit run used by Codecov.

## DNS and credentials

The Source-wide Cloudflare control plane lives at `.workspace/credentials/` (singular). Reuse
`cloudflare-api-token.key.enc` and `cloudflare-<tunnel>-tunnel-token.key.enc` through SOPS without printing
plaintext. Product-owned SonarQube admin, database and scanner tokens remain in their approved encrypted stack
records; Cloudflare credentials never move into a product repository's CI secrets.

Default public naming is `sonar.<zone>`. Plan the exact hostname, shared tunnel and SonarQube HTTP origin with
`@tunnel-set`. External tunnel/DNS mutation requires the displayed `### NEED APPROVALS` plan and `OK`.
Reconciliation merges this route without deleting MCP or other ingress entries.

## Proof

Prove all containers healthy, the default SonarQube admin password replaced, public system status reachable,
project key unique, scanner analysis accepted, quality gate completed, encrypted credential records present,
and no plaintext credential tracked or printed. A running dashboard alone is not project assurance; CI must
still enforce the scanner and quality-gate result.
