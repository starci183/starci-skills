---
title: Initialization · identity
---

# Identity

## LOADS

None.

The machine identity is `~/.starci/master.identity`. It is private machine state: never commit it, copy
it into `.workspaces`, place it in a command argument, or print its contents or derived secret material.

Run `node .claude/scripts/init-identity.mjs --source <Source> --plan` first. The preflight proves `sops`,
`age`, and `age-keygen` are callable, validates the identity with `age-keygen -y`, and verifies a real
decrypt. If the Source already contains ciphertext, its first encrypted record is the sample and the
original identity must be imported through hidden input or `--from-file`. A newly generated identity
would make existing ciphertext permanently foreign, so generation is refused in that state.

If no ciphertext exists, the script may generate the first identity and verifies it against a temporary
SOPS+age sample before installing it. An existing identity is reused, never replaced. `--from-file` is
read without echo and is never deleted; ownership of the source file remains with the operator.

Verdicts are `ready`, `import-required`, `generate`, or `blocked`. Evidence is tool, identity, ciphertext,
and sample state; action reuses, imports, or generates exactly one identity; proof validates the public
recipient and decrypts the sample. This action never authorises bootstrap, route, worktree, secret,
network, or product writes.
