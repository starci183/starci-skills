# Changelog

## 1.2.0 - 2026-10-09

- Changed: the catalog, help and shell completions follow the runtime of 1.0.0-alpha.9 (the `kernel report` summary, the `kernel decide` verb, the `release cut`/`release notes` `--repo` default, the `starci test affected` summary line), and the package depends on `@starci/hfs` 4.2.0. Version 1.1.0 on the registry was published before these verbs changed; its catalog is that of an earlier runtime.

## 1.1.0 - 2026-10-08

- Changed: the catalog, help and shell completions follow the runtime of 1.0.0-alpha.7 (the release cut refuses early on host prerequisites, `starci release env-test`, the plan of `starci release publish` names every blocker in its json result), and the package depends on `@starci/hfs` 4.1.0.

## 1.0.0

- Introduce the catalog-driven `starci` dispatcher, generated help and shell completions.
- Route app commands to `@starci/hfs` and runtime commands to an installed StarCi tree.
- Add the in-process `starci runtime install` bootstrap.
