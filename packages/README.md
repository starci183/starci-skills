# starci-eslint

The machines behind the StarCi lint canon. Two flat-config plugins, one per side, and every rule is
paired with the test that proves it fires on the code it refuses.

| Package | Rules | Tests |
|---|---|---|
| [`@starci/eslint-canon-fe`](packages/fe) | 18 law modules | **101 passing** |
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
