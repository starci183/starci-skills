# Build and release StarCi

This is the maintainer workflow, not a requirement for users installing a reviewed archive. Package preparation does not publish to npm or push Git. Runtime consumers receive sources only; the runtime reads them in place. See [runtime distribution](runtime-distribution.md).

## Verify source

```sh
npm ci
npm test
```

Review source changes and test failures. Do not weaken validators to produce a green release. Knowledge is authored as YAML under `knowledge/` and read directly; see [knowledge YAML](knowledge-yaml.md). The runtime bundles its YAML dependency in `engine/yaml.mjs`; retain its license notice (`engine/yaml-license.json`, THIRD_PARTY_NOTICES.md) when deliberately changing that dependency.

## Make an archive

```sh
npm pack --json --pack-destination /absolute/release-output
```

Create that output directory first, outside the runtime and product trees. `prepack` runs the source verification above in the packing checkout. `prepack` does not replace the full tests above. Inspect the resulting file inventory for local configuration, secrets, `config.yaml`, product records, Git state, `node_modules`, `worktrees/` and unrelated build output. `package.json.files` explicitly bounds the installed payload: sources, `scripts/`, `modules/`, `engine/` (including bundled `engine/yaml.mjs`), `skills/`, `init/`, `knowledge/`, `docs/`, tests and human docs; keep all runtime references available after relocation.

Test the **archive**, not only the source checkout:

```sh
npx --yes --package=/absolute/release-output/<archive>.tgz starci --help
npx --yes --package=/absolute/release-output/<archive>.tgz starci init --dir /absolute/isolated-host
node /absolute/isolated-host/.claude/bin/starci.mjs doctor --dir /absolute/isolated-host --quick
```

Also verify an update preserving custom host instructions and a seeded `config.yaml`. Record the archive hash and test results with the handoff. Do not test installation against an active user's runtime.

## Publication is a separate approval

The intended package is `starci`. A registry lookup returning not-found is not proof of namespace ownership. Before any publish, the maintainer must confirm authenticated npm account rights, name/version availability, archive contents, license ownership and intended prerelease dist-tag. Require explicit publication authority, then publish the exact reviewed archive. Do not expose tokens in logs or source. Update README release status only after registry verification succeeds.

Never publish unrelated dirty changes, silently retag a stable release as a pre-release, or assume the previous `@starci/skills` package redirects users. Announce the naming transition and upgrade limits in the release notes.
