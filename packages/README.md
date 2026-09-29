# StarCi packages and how a product repository gets them

The packages under `.claude/packages` are the shared tooling of every StarCi product repository. **They are not
published to a registry.** A product repository (and its CI) installs them from the runtime checkout, which
`STARCI_HOME` names (the directory holding `bin/`, `packages/` and `knowledge/`), with one command.

| Package | Side | Replaces in the repo |
|---|---|---|
| [`@starci/tsconfig`](tsconfig) | both | the strict flags copied into each tsconfig |
| [`@starci/prettier-config`](prettier-config) | both | ESLint layout rules (`indent`, `quotes`, `semi`, ...) |
| [`@starci/jest-preset`](jest-preset) | back end | the hand-copied `jest.config.js`, `as unknown as` casts |
| [`@starci/vitest-preset`](vitest-preset) | front end | the hand-copied `vitest.config.ts` files |
| [`@starci/playwright-preset`](playwright-preset) | front end | the hand-copied `playwright.config.ts` |
| [`@starci/hfs`](hfs) | both | the ad-hoc structure checks: `hfs check`, `hfs init`, `hfs explain` |
| [`@starci/eslint-canon-be`](eslint/be), [`-fe`](eslint/fe) | be / fe | the lint rules |
| [`@starci/stylelint-canon`](stylelint) | front end | hand-written CSS: raw colour, spacing and `!important` |
| [`@starci/grammar`](grammar) | front end | the design system |

The exact version of each, and of every framework a repository pins, is
[`knowledge/hfs/canon-pins.yaml`](../knowledge/hfs/canon-pins.yaml). `node scripts/checks/check-canon-pins.mjs` proves each
@starci pin equals its package here; with `--repo <dir>` it proves a repository matches the pins.

## `starci link`

```sh
export STARCI_HOME=/path/to/runtime      # PowerShell: $env:STARCI_HOME = "D:\Repositories\starci-academy-backend\.claude"
node "$STARCI_HOME/bin/starci.mjs" link --side be --install     # or --side fe
```

For every `@starci/*` package the side owns, `link`:

1. copies exactly the files `npm pack` would publish (the package's `files` list) into
   `<repo>/.starci/packages/<name>/`: a plain directory, no symlink, no junction, no administrator rights, no tarball;
2. sets `"@starci/<name>": "file:.starci/packages/<name>"` in `package.json` (`dependencies` if the repository already
   lists it there, else `devDependencies`). The path is relative to the repository, so the same text is valid on every
   machine;
3. adds `/.starci/` to `.gitignore` and writes `.starci/link.json`;
4. with `--install`, runs `npm install`.

npm installs a `file:` directory as a link to that directory. It lies inside the repository, so the package resolves its
peers (`jest`, `typescript`, `@types/jest`, `vitest`) from the repository's own `node_modules`, never from the runtime.
`package-lock.json` records `{"resolved": ".starci/packages/<name>", "link": true}` with no integrity hash, so it is
identical on Windows and Linux and does not depend on how `npm pack` compresses. The generated copy is untracked;
`package.json` and the lockfile are what is committed.

**CI.** Check out the runtime, then run `link` **before** `npm ci` (`npm ci` needs the directory to exist):

```yaml
- uses: actions/checkout@v4
  with: { repository: starci183/starci-skills, path: .starci-runtime }
- run: echo "STARCI_HOME=$GITHUB_WORKSPACE/.starci-runtime" >> "$GITHUB_ENV"
- run: node "$STARCI_HOME/bin/starci.mjs" link --side be
- run: npm ci
```

**Upgrading.** Raise the version in `knowledge/hfs/canon-pins.yaml` together with the package, then re-run `link` in each
repository (it replaces the copy) and `npm install`. After pulling a newer runtime the local flow is the same two commands.

**Why not the alternatives.** `"file:${STARCI_HOME}/packages/x"` is not portable: npm does not expand variables in
`package.json`. `file:../../runtime/packages/x` bakes one machine's layout into a committed file. A directory link to the
runtime makes peers resolve from the runtime's `node_modules`, and a symlink needs Developer Mode on Windows. A packed
tarball records an integrity hash that changes with line endings or the zlib version, and `npm ci` then fails.

Proven on 2026-09-29 on a scratch copy of mia-mia-backend: `link --side be
--install`, then a clean `rm -rf node_modules && link && npm ci` (691 packages, four `link: true` lockfile entries), then
`tsc --noEmit`, `jest --selectProjects unit` and `prettier --check` against the linked packages.

---

# starci-eslint

The machines behind the StarCi lint canon. Two flat-config plugins, one per side, and every rule is
paired with the test that proves it fires on the code it refuses.

| Package | Rules | Tests |
|---|---|---|
| [`@starci/eslint-canon-fe`](packages/fe) | 29 law modules | **137 passing** |
| [`@starci/eslint-canon-be`](packages/be) | 15 law modules | 54 passing, **3 failing** |

The laws these enforce live in the trust tree at `gates/{fe,be}/lints`, one module per law, which state
what each rule refuses, the evidence it points at, and the escape hatches that are closed. **This repo is
the machine; the tree is the law.** A rule here with no law there is unaccountable; a law there with no
rule here only advises.

## Using it

```bash
npm install --save-dev @starci/eslint-canon-fe
```

```js
// eslint.config.mjs
import canon from "@starci/eslint-canon-fe"

export default [canon.configs.recommended]
```

## Testing it

```bash
npm install
npm test          # both packages
npm run test:fe
npm run test:be
```

A rule ships with the test that fires it. The test is not a formality: it is how a reader checks that the
rule refuses the thing the law says it refuses, and not something adjacent.

**A red test stays red.** Four assertions fail, from three different causes — one real defect in the BE
plugin and two twin tests that read repositories this package no longer sits inside. All four are
documented in [KNOWN-DEFECTS.md](KNOWN-DEFECTS.md) and none is skipped: skipping to get a green push
would remove the only evidence each problem exists.
