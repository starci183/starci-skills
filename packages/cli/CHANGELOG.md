# Changelog

## 1.7.0 - 2026-10-18
- Changed: pins @starci/hfs 4.7.0 and carries runtime 1.0.0-alpha.22; `release cut`, `app release` and `release ci-override` help describe the candidate CI flow; `release app-installs --source`; `app coverage merge` and `app ci local` help.

## 1.6.0 - 2026-10-18
- Changed: pins @starci/hfs 4.6.0 and carries runtime 1.0.0-alpha.21; `npm install` moves a StarCi pin only where a package.json declares it; `app ci` help documents ownerValue variables.

## 1.5.1 - 2026-10-18
- Changed: pins @starci/hfs 4.5.1 and carries runtime 1.0.0-alpha.20 with the refreshed release catalog.

## 1.5.0 - 2026-10-17
- Added: `app ci` and owner-only `release ci-override`; regenerated command docs and shell completions.
- Changed: catalog documents DB dump/reset, app release audit/Sonar and CI checks, cut CI protection, npm install target canon pins and verified public Sonar startup.

## 1.4.1 - 2026-10-17
- Changed: depends on @starci/hfs 4.4.1 and carries runtime 1.0.0-alpha.19; the catalog drops `starci test affected`, `starci test run`, `starci gate runtime-coverage` and `starci release env-test` and adds `starci release scaffold-e2e` (owner ruling no-runtime-specs, 2026-10-17).

## 1.3.0 - 2026-10-15
- Changed: depends on @starci/hfs 4.3.0; `starci gate starcistacks` and `starci app check` validate the lite docker-swarm production stack (catalog regenerated), rebased onto alpha.13 (cli 1.2.17).

## 1.2.16 - 2026-10-14
- Added: `starci app secret init|set|get|materialize|list` (the generated catalog, docs and shell completions), replacing `list|show|set|gen`.


- Changed: pin HFS 4.3.0 (manifest 3.1.0: the app composition standard, `compose/<area>.ts` groups and the composition budgets). Command dispatcher implementations are unchanged.

## 1.2.17 - 2026-10-14

- Changed: pin HFS 4.2.17 (the webhook door spec template signs with a per-run key). Command dispatcher implementations are unchanged.

## 1.2.16 - 2026-10-14

- Changed: pin HFS 4.2.16 (templates the published canons accept). Command dispatcher implementations are unchanged.

## 1.2.15 - 2026-10-13

- Changed: pin HFS 4.2.15 (the toast skeleton and the core fe stack take the heroicons family as the one icon set) and carry runtime 1.0.0-alpha.13. Command dispatcher implementations are unchanged.

## 1.2.14 - 2026-10-13

- Changed: pin HFS 4.2.14 (manifest 3.0.0, the lite edition re-ruled as full minus self-hosted infrastructure) and carry runtime 1.0.0-alpha.13. Command dispatcher implementations are unchanged.

## 1.2.13 - 2026-10-12

- Changed: pin HFS 4.2.13 for the merged Grammar 0.9.13 and Stylelint canon 2.0.9 closure; carry runtime 1.0.0-alpha.12 and the merged runtime fixes. Command dispatcher implementations are unchanged.

## 1.2.12 - 2026-10-12

- Changed: pin HFS 4.2.12 (canon pins for grammar 0.9.12); carries runtime 1.0.0-alpha.12; command behavior is unchanged.

## 1.2.11 - 2026-10-12

- Changed: pin HFS 4.2.11 (canon pins for grammar 0.9.11); carries runtime 1.0.0-alpha.12; command behavior is unchanged.

## 1.2.10 - 2026-10-12

- Changed: pin HFS 4.2.10 (canon pins for grammar 0.9.10); carries runtime 1.0.0-alpha.12; command behavior is unchanged.

## 1.2.9 - 2026-10-12

- Fixed: regenerate the runtime install pin for 1.0.0-alpha.12; 1.2.8 still shipped the 1.0.0-alpha.10.1 pin.
- Changed: pin HFS 4.2.9 with the refreshed canon closure; command dispatch is unchanged.

## 1.2.8 - 2026-10-12

- Changed: pin HFS 4.2.8 with the refreshed canon closure and carry runtime 1.0.0-alpha.12; command dispatch is unchanged.

## 1.2.7 - 2026-10-12

- Changed: pin HFS 4.2.7 (canon pins for grammar 0.9.8); carries runtime 1.0.0-alpha.12; command behavior is unchanged.

## 1.2.6 - 2026-10-12

- Changed: pin HFS 4.2.6 (canon pins for grammar 0.9.7 and heroicons 0.3.3); command behavior is unchanged.

## 1.2.5 - 2026-10-11

- Changed: carry runtime version 1.0.0-alpha.10.1 and pin HFS 4.2.5; command behavior is unchanged.

## 1.2.4 - 2026-10-11

- Changed: carry runtime version 1.0.0-alpha.10; behaviour is unchanged.

## 1.2.3 - 2026-10-11

- Changed: refresh the bundled canon pins for @starci/grammar 0.9.3 and the canon packages; behaviour is unchanged.

## 1.2.2 - 2026-10-11

- Changed: runtime install selects 1.0.0-alpha.9.1, and the app dispatcher depends on HFS 4.2.2.

## 1.2.1 - 2026-10-10

- Changed: depend on the HFS patch that preserves Redis database identity in scaffolded queue connections.

## 1.2.0 - 2026-10-09

- Changed: the catalog, help and shell completions follow the runtime of 1.0.0-alpha.9 (the `kernel report` summary, the `kernel decide` verb, the `release cut`/`release notes` `--repo` default, the `starci test affected` summary line), and the package depends on `@starci/hfs` 4.2.0. Version 1.1.0 on the registry was published before these verbs changed; its catalog is that of an earlier runtime.

## 1.1.0 - 2026-10-08

- Changed: the catalog, help and shell completions follow the runtime of 1.0.0-alpha.7 (the release cut refuses early on host prerequisites, `starci release env-test`, the plan of `starci release publish` names every blocker in its json result), and the package depends on `@starci/hfs` 4.1.0.

## 1.0.0

- Introduce the catalog-driven `starci` dispatcher, generated help and shell completions.
- Route app commands to `@starci/hfs` and runtime commands to an installed StarCi tree.
- Add the in-process `starci runtime install` bootstrap.
