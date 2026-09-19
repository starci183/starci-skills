# Nest test configuration and discovery checks

`scripts/checks/code-patterns/nest-metadata.mjs` owns `NEST_JEST_ALIAS_PARITY` and
`NEST_TEST_DISCOVERY`. It measures the target-local TypeScript/Jest installation,
not StarCi's own dependency versions. These checks inspect test configuration and
list test paths; they do not execute test bodies, setup hooks, UAT or infrastructure.
Jest configuration itself is executable code and is loaded by its normal CLI.

## Project binding

The default is the repository's auto-selected Jest config with `tsconfig.json`.
Multiple configs or different compiler projects are declared in the target's
`package.json`:

```json
{
  "starci": {
    "codePatterns": {
      "nest": {
        "testProjects": [
          { "config": "jest.config.ts", "tsconfig": "tsconfig.json" },
          { "config": "src/tests/e2e/jest-e2e.json", "tsconfig": "tsconfig.json" }
        ]
      }
    }
  }
}
```

Use `config: null` for root auto-selection. Optional `selectProjects` lists exact
Jest display names when one config has several compiler bindings. Every normalized
project in that config must be bound exactly once. This list selects actual runner
lanes; it is not a list of files exempted from discovery. Environment-selected
lanes must be discoverable in the measurement's actual environment. A disabled
lane does not supply discovery evidence for the tests it omitted.

## What the scripts prove

- `NEST_JEST_ALIAS_PARITY` compares resolved TS paths (including inherited config)
  with normalized Jest mappings, target order and mapper precedence. Canonical
  anchored exact and single-wildcard mapper forms are supported. Unprovable regex
  precedence is unavailable coverage. Explicit `ts-jest` project overrides must
  agree with the selected compiler project; inline/disabled overrides are
  unavailable. This does not prove behavior of a custom resolver or transformer.
- `NEST_TEST_DISCOVERY` compares authored `*.spec.*`, `*.test.*`, and lane forms
  such as `*.container-spec.ts` against the union returned by actual Jest
  `--listTests`. It scans source/test roots, including nested `dist`-named folders;
  missing paths are findings. No count of specs proves that assertions are useful.
- Pure `discoverNestMetadataInputs` resolves configuration inputs before running
  Jest, including static local config imports and inherited compiler config.
  Dynamic config dependencies, unsafe paths, missing tools, failed commands and
  malformed results are unavailable coverage. The parent must bind these inputs
  and tool files before and after the check; the checker repeats this validation,
  normalized runner config and actual runner test listing. Static preset package
  implementations are included. A custom resolver needs a separately verified
  adapter and cannot pass on mapper configuration alone.

The uniform result has `schema: starci/code-pattern-script@1`, exact requested
metadata `files`, requested/checked rule IDs, located or related-path findings,
compiler/tool identities and input fingerprints. `contextFiles` carries the
parent's full source/input inventory. Additional discovered inputs are returned
as `inputFiles`. Changes during measurement invalidate the result.

## Sources and verification boundary

Read on 2026-09-16: [Jest CLI](https://jestjs.io/docs/cli#--listtests),
[Jest configuration](https://jestjs.io/docs/configuration#modulenamemapper-objectstring-string--arraystring),
and [TypeScript paths](https://www.typescriptlang.org/tsconfig/paths.html).
The CLI listing and normalized config inform this check; StarCi's all-authored-spec
coverage and mapper parity requirements are its adopted code standard.

Protocol regression tests use a controlled runner to exercise hostile/malformed
output and mutation. A separate read-only Nivo smoke with real Jest 29.7.0 found
742 listed paths and 162 authored specs absent from the default lane configuration;
aliases passed and inputs were stable. That observation is point-in-time discovery
evidence, not evidence those tests ran or the product passed. Academy's target
TypeScript was unavailable during the attempted smoke and correctly blocked it.
