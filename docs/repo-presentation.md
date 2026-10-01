# Repository presentation checklist

The HFS root law is [repo.folder](../knowledge/patterns/repo/folder.yaml). Apply this checklist
to each app repository (its root README; `be/` and `fe/` carry none) and to the StarCi runtime README. The product gate is
`node scripts/checks/repo-presentation.mjs --root <app>`; the runtime uses
`node scripts/checks/repo-presentation.mjs --root . --runtime`.

- [ ] Keep `README.md` and `.gitattributes` at the root. Put stray drafts such as `raw.md`
  under `docs/` or their owning `.starciwork` record. Remove dead configuration and stale
  workspace files such as `pnpm-workspace.yaml` from npm repositories.
- [ ] Start the README with `# <repository name>`, followed by one description line.
  Add `## Overview`, `## Stack`, `## Repository layout` (an HFS map of the root, `be/` and `fe/`) and
  `## Development` in that order. Document the actual install, typecheck, lint, build
  and test commands. Add `## Work` with a `.starciwork` link when that tree is present.
- [ ] Link badges only to live external services. Never show a badge for local SonarQube
  or link a README to localhost, loopback, RFC1918, `.local` or other private hosts.
  Inline code may name a local development URL. Verify badge service health manually:
  a static checker cannot prove a remote service is currently live.
- [ ] Keep `.github/` for required repository CI under the HFS root contract. Add
  `PULL_REQUEST_TEMPLATE.md`, `ISSUE_TEMPLATE/` and `CODEOWNERS` there when useful;
  those template and ownership files are optional.
- [ ] Set the GitHub repository description and topics to match the current README,
  using `gh repo edit --description "<one-line description>" --add-topic <topic>`.
  Check with `gh repo view --json description,repositoryTopics`. Do this only for the
  repository the owner has authorized you to edit.
- [ ] Run the presentation gate and `canon-scan`; the HFS rules also run inside the
  architecture machine of `canon-scan`.
