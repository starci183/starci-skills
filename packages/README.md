# StarCi packages and how a product repository gets them

The packages under `.claude/packages` are the shared tooling of every StarCi product repository. **Every one of them is published to the public npm registry** (scope `@starci`), and a product repository (and its CI) installs it from there at the exact version pinned in `knowledge/hfs/canon-pins.yaml`: `"@starci/x": "<version>"`, never a range, never `file:`. One pattern, no other way to obtain them.

| Package | Side | Replaces in the repo |
|---|---|---|
| [`@starci/tsconfig`](tsconfig) | both | the strict flags copied into each tsconfig |
| [`@starci/prettier-config`](prettier-config) | both | ESLint layout rules (`indent`, `quotes`, `semi`, ...) |
| [`@starci/jest-preset`](jest-preset) | back end | the hand-copied `jest.config.js`, `as unknown as` casts |
| [`@starci/test-world`](test-world) | back end | the per-repository test-world infrastructure (stack, fakes, Nest boot, `useTestWorld`, `useSandbox`) |
| [`@starci/hfs`](hfs) | both | the ad-hoc structure checks: `hfs check`, `hfs init`, `hfs explain` |
| [`@starci/eslint-canon-be`](eslint/be), [`-fe`](eslint/fe) | be / fe | the lint rules |
| [`@starci/stylelint-canon`](stylelint) | front end | hand-written CSS: raw colour, spacing and `!important` |
| [`@starci/grammar`](grammar) | front end | the design system |

The exact version of each, and of every framework a repository pins, is
[`knowledge/hfs/canon-pins.yaml`](../knowledge/hfs/canon-pins.yaml). `node scripts/checks/check-canon-pins.mjs` proves each
@starci pin equals its package here; with `--repo <dir>` it proves a repository matches the pins.

## Installing and upgrading

Set each `@starci/*` dependency (root and every workspace) to the exact version in `knowledge/hfs/canon-pins.yaml`, then `npm install`. CI needs nothing else: `npm ci` reads the registry.

**Publishing.** Raise the version in the package and in `knowledge/hfs/canon-pins.yaml` in the same change (`node scripts/checks/check-canon-pins.mjs` proves they agree), run `node scripts/gates/package-clean-test.mjs` and publish only when every package of the publish set is green (each one copied to a temp dir, installed from its own manifest and lockfile with nothing hoisted, its own `npm test` run there; the eslint canons install as the `packages/` workspace; exit 1 is a red package, 2 a proof that could not run), `npm publish` from the package directory (each has `publishConfig.access: public` and a `files` allowlist; check it with `npm pack --dry-run`), verify with `npm view <name>@<version> version`, then move the repositories to the new pin in their own upgrade lanes. A version already on the registry is never republished: bump it.

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

**A red test stays red.** A failing assertion is never skipped to get a green push: skipping would
remove the only evidence the problem exists.
