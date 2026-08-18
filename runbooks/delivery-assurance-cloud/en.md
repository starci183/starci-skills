---
title: Delivery assurance cloud
---

# Delivery assurance: Codecov and SonarQube Cloud

## Use when

Use this page to connect a backend repository to Codecov Cloud and SonarQube Cloud, publish credentials
without plaintext, obtain the first green pull request and then make those checks mandatory.

## Before

Local source gates must already pass. The GitHub operator needs repository admin access, Codecov and
SonarQube Cloud accounts bound to the GitHub organization, `gh` authentication, SOPS and the master identity.

```powershell
gh auth status
npm ci
npm run lint:check
npm run typecheck
npm run build
npm run test:ci
```

## Secrets

| Name | Encrypted owner | GitHub projection |
|---|---|---|
| Codecov upload token | `.stacks/dev/runtime/files/codecov-token.key.enc` | `CODECOV_TOKEN` secret |
| Sonar analysis token | `.stacks/dev/runtime/files/sonarqube-token.key.enc` | `SONAR_TOKEN` secret |
| Sonar EU endpoint | not secret | `SONAR_HOST_URL=https://sonarcloud.io` variable |

## Run

### Codecov Cloud

1. Sign in with GitHub, install the Codecov GitHub App for the organization and grant this repository.
2. Open the repository's setup page and copy its upload token.
3. Print the value-free plan, then store and project it through one hidden/process-env input:

```powershell
node .claude/scripts/publish-secret.mjs --name CODECOV_TOKEN --stack ".::dev/runtime/files/codecov-token.key" --repo starci-lab/starci-academy-backend --plan
node .claude/scripts/publish-secret.mjs --name CODECOV_TOKEN --stack ".::dev/runtime/files/codecov-token.key" --repo starci-lab/starci-academy-backend
```

4. Keep `coverage/lcov.info`, `codecov/codecov-action@v5`, `fail_ci_if_error: true`, and blocking project/
patch statuses in `codecov.yml`.

### SonarQube Cloud

1. Bind the `starci-lab` GitHub organization and import the repository.
2. Disable Automatic Analysis; it ignores this CI configuration and cannot import coverage.
3. Select GitHub Actions/CI-based analysis.
4. Copy the actual organization and project keys from Project Information into `sonar-project.properties`:

```properties
sonar.organization=<actual-organization-key>
sonar.projectKey=<actual-project-key>
sonar.javascript.lcov.reportPaths=coverage/lcov.info
```

5. Create a scoped organization token where the plan supports it, otherwise a personal analysis token.
6. Print the value-free plan, then store and project it:

```powershell
node .claude/scripts/publish-secret.mjs --name SONAR_TOKEN --stack ".::dev/runtime/files/sonarqube-token.key" --repo starci-lab/starci-academy-backend --plan
node .claude/scripts/publish-secret.mjs --name SONAR_TOKEN --stack ".::dev/runtime/files/sonarqube-token.key" --repo starci-lab/starci-academy-backend
gh variable set SONAR_HOST_URL --repo starci-lab/starci-academy-backend --body "https://sonarcloud.io"
```

7. Ensure checkout uses full history and CI runs exactly one coverage test before Codecov/Sonar:

```yaml
with:
  fetch-depth: 0
```

Commit only the configuration and encrypted records, push a non-main branch and open a pull request.

## Verify

```powershell
gh secret list --repo starci-lab/starci-academy-backend
gh variable list --repo starci-lab/starci-academy-backend
gh pr checks --watch
```

The pull request must show `CI / verify`, Codecov project/patch statuses and SonarQube Code Analysis. In
both provider dashboards, the revision must match the pull request SHA and both must consume the same LCOV.
After a successful run, configure a `main` ruleset requiring the exact contexts supplied by their expected
GitHub Apps. Required checks must be observed first; do not invent a context name.

## Stop or rollback

Disable a repository in the provider or revoke its token to stop uploads. Do not remove branch protection
until a replacement check is live; temporarily roll back the provider configuration and token together.

## Rotate

Create the new provider token, replace the encrypted record, replace the GitHub Secret, rerun one PR,
then revoke the old token. `SONAR_HOST_URL` changes only when region/instance changes.

## Troubleshoot

| Symptom | First check |
|---|---|
| Codecov unauthorized | repository token and GitHub App repository access |
| Codecov status absent | App installed and project/patch enabled in `codecov.yml` |
| Sonar project not found | actual organization/project keys from Project Information |
| Sonar duplicate analysis | Automatic Analysis is still enabled |
| Sonar coverage is zero | `coverage/lcov.info` exists before the scan and path is unchanged |
| required check cannot be selected | let that exact check complete in the repository first |
| private repo cannot create ruleset | upgrade the GitHub plan or make the repository public |

## Upstream

- [Codecov Quick Start](https://docs.codecov.com/docs/quick-start)
- [Codecov Action](https://github.com/codecov/codecov-action)
- [SonarQube Cloud GitHub Actions](https://docs.sonarsource.com/sonarqube-cloud/advanced-setup/ci-based-analysis/github-actions-for-sonarcloud)
- [SonarQube Cloud automatic-analysis limits](https://docs.sonarsource.com/sonarqube-cloud/advanced-setup/automatic-analysis)
- [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
