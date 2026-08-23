---
title: Lint machine
---

# Lint machine

## LOADS

None.

## Stale signature

The checkout does not install the published StarCi lint canon by package name, or its ESLint config imports
a vendored rule copy. A green count before this check is not evidence.

## List evidence

Report exactly one verdict per role:

- `installed`: package present and config imports it by package name.
- `absent`: package is missing; nothing meaningful was checked.
- `vendored`: config imports a relative/private rule copy; results target a drifting snapshot.

Never execute lint for this read-only verdict.

## Repair inventory

Read manifest, lockfile, ESLint config and every relative rule import. Preserve the repository's glob and
severity configuration; this pass owns machine adoption, not local policy.

## Apply

Take the repair baseline before installation. Use the repository's lockfile-respecting package manager,
install the published canon, remove the vendored rule implementation and repoint imports to the package.
Never author or patch a rule in the consumer checkout.

## Proof

Manifest and lockfile install the canon, ESLint imports it by package name, no vendored implementation is
reachable, then source-gate counts are measured for the first time.
