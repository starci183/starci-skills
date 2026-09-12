# Build and release StarCi

This is the maintainer workflow, not a requirement for users installing a reviewed archive. Package preparation does not publish to npm or push Git. Runtime consumers receive sources and compilers; `.dist` is built on the host during `init`/`update`. See [runtime distribution](runtime-distribution.md).

## Verify source

```sh
npm ci
node scripts/compile-knowledge.mjs
npm run build
npm test
npm --prefix sites/skills ci
npm run build:sites
node scripts/compile-knowledge.mjs --check
npm run build:check
node scripts/ensure-build.mjs
```

Review source changes, generated contracts and test failures. Do not weaken validators to produce a green release. Knowledge is authored as YAML under `knowledge/` and compiled into `.dist/knowledge/`; see [knowledge YAML](knowledge-yaml.md). The runtime bundles its YAML dependency in `core/yaml.mjs`; rebuild it with `npm run build:yaml` when deliberately changing that dependency and retain its license notice. Never `git add -f` `.dist`; `/.dist/` stays ignored.

## Make an archive

```sh
npm pack --json --pack-destination /absolute/release-output
```

Create that output directory first, outside the runtime and product trees. `prepack` regenerates and checks compiled contracts in the packing checkout; the published tarball still **excludes** `.dist`. Install/update rebuilds and verifies `.dist` on the target before recording success. `prepack` does not replace the full tests above. Inspect the resulting file inventory for local configuration, secrets, `config.json`, product records, Git state, `node_modules`, `worktrees/`, site caches (`.next`, `dist`, `out`) and unrelated site output. `package.json.files` explicitly bounds the installed payload: include sources, compilers (`scripts/`, `ops/generate.mjs`), bundled `core/yaml.mjs`, schemas needed to build, doctor tests and human docs; keep all runtime references available after relocation.

Test the **archive**, not only the source checkout:

```sh
npx --yes --package=/absolute/release-output/starci-4.2.0.tgz starci --help
npx --yes --package=/absolute/release-output/starci-4.2.0.tgz starci init --dir /absolute/isolated-host
node /absolute/isolated-host/.claude/bin/starci.mjs doctor --dir /absolute/isolated-host --quick
```

Also verify new workspace initialization/validation, an update preserving custom host instructions, and explicitly bound legacy storage. Record the archive hash and test results with the handoff. Do not test installation against an active user's runtime.

## Publication is a separate approval

The intended package is `starci`, release `4.2.0`. A registry lookup returning not-found is not proof of namespace ownership. Before any publish, the maintainer must confirm authenticated npm account rights, name/version availability, archive contents, license ownership and intended prerelease dist-tag. Require explicit publication authority, then publish the exact reviewed archive. Do not expose tokens in logs or source. Update README release status only after registry verification succeeds.

Never publish unrelated dirty changes, silently retag a stable release as an alpha, or assume the previous `@starci/skills` package redirects users. Announce the naming transition and migration limits in the release notes.
