# Changelog

All notable changes to StarCi are documented here. The runtime is on the `1.0.0-alpha.N` line: contracts are provisional
until every S* row in `docs/goal.md` holds with fresh evidence, then `1.0.0` freezes them.
`package.json` `version` is the only version authority.

## [1.0.0-alpha.5] — 2026-10-06

Theme: host prompts move under the public entry, host state lives under the runtime root, and the runtime gains artifact, install-sandbox and Sonar proof.

### Changed
- The host startup and maintenance prompts live at `skills/starci/references/host-startup.md` and `host-maintenance.md`; the `.starci/` source directory is gone.
- Host state and artifacts live under `<runtime root>/.runtime`, which is git-ignored and never packaged; nothing is relocated from earlier per-user locations.
- The machine store has one schema and no upgrade path: a store that is not the current schema is refused unchanged.
- The entry check validates the bootstrap files of the hosts an install selected.
- The runtime repository's CI runs on every push to `main` as well as on `v*` tags and by hand (static checks, coverage, Codecov, and the SonarCloud scan on `main`), the runtime artifact is built on every main push, and a fast-forward push of `main` needs no release tag; rule R221 allows the `main` push in the runtime's own workflows only, and app CI templates keep the tag-only law.

### Added
- A `runtime-artifact` workflow (manual dispatch) packs the runtime with version, SHA and hash metadata plus an inventory, and refuses host-local or secret material.
- An `install-sandbox` workflow and `scripts/gates/install-sandbox.mjs` prove a clean-machine install on Windows and Linux.
- Runtime coverage (`npm run test:coverage`, Codecov flag `runtime`, informational) and a SonarCloud analysis of the runtime in the tag run.
- A packed-import guard in the runtime package proof.

### Fixed
- The command guard hook resolved through the per-user launcher on PATH, which bash does not find as `starci.cmd`, so every guarded Bash call of a Windows seat ran unguarded behind a non-blocking hook error. The hook command now names the launcher by absolute path, `starci runtime install` and `runtime link` write an extensionless POSIX launcher beside `starci.cmd`, launch trust refuses a launch whose guard command no shell can run (`guard-command-unresolvable`), and the host check has a required row `command guard resolvable`.
- SonarCloud bug and vulnerability findings across `engine/`, `scripts/`, `ui/` and `packages/`: explicit code-unit sort comparators, regexes without catastrophic backtracking, secret redaction in the assisted-UAT runner, a quiet-since fallback in progress RCA, tightened file modes, GitHub Actions pinned by commit SHA and `npm ci --ignore-scripts` in workflows.
- The packed runtime no longer imports modules absent from the package.
- The installer names a missing or unsupported `age-keygen`.

### Known limitations
- Sonar, Linux parity, the L3 and L4 ladders, UAT and the full unit and e2e suites did not run for this release; only targeted specs and checks did.
- The two product workflows are not yet proven running; `1.0.0` waits for that proof.
