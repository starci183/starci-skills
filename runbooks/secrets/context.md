---
title: Secrets
runtime: true
source: en.md
sourceHash: d39d07d1366a0a52bad317a146a40842cc562f5b2a28fc6f0adb414a1da21928
contextVersion: 1
---

# Secrets

## LOADS

None.

## Use when

Use this page on a fresh machine, when a provider issues a new token, when a stack record is absent,
or when a credential must rotate without appearing in source, shell history or terminal output.

## Before

```powershell
sops --version
age --version
Test-Path "$env:USERPROFILE\.starci\master.identity"
git status --short
```

The identity check must return `True`; restore the existing identity from the password manager rather
than generating a new one. Stop if the worktree already contains an unexplained plaintext credential.

## Secrets

The authoritative map is `scripts/credentials.mjs`:

- `CREDENTIALS` are infrastructure values the repository may mint.
- `DERIVED_CREDENTIALS` are rebuilt from minted values.
- `APP_CREDENTIALS` are issued by third parties and must be supplied by an operator.

## Run

Mint repository-owned development credentials, then decrypt approved records and write the ignored env bridge:

```powershell
npm run secret:gen -- dev
npm run sync
```

Store one third-party value through a hidden prompt. Omit `.stacks/` and `.enc`; the tool adds both:

```powershell
npm run secret:set -- dev/runtime/files/<name>.key
```

When the same value must also become a GitHub Actions secret, use the Source publisher. It prints only
the environment-variable name and targets. `--plan` performs no write; the apply invocation reads
`<SECRET_NAME>` from the current process environment when present, otherwise it opens a hidden prompt:

```powershell
node .claude/scripts/publish-secret.mjs --name <SECRET_NAME> --stack ".::<record-under-.stacks>" --repo <owner/repository> --plan
node .claude/scripts/publish-secret.mjs --name <SECRET_NAME> --stack ".::<record-under-.stacks>" --repo <owner/repository>
```

Never put the value after `--name`, in a generated command, or in chat. Repeat `--repo` only when the
provider credential itself is organization/global scoped; a repository token stays with one repository.

For a JSON credential already held in a protected file:

```powershell
npm run secret:set -- dev/runtime/files/<name>.json --from-file <protected-path>
```

List names without values:

```powershell
npm run secret:list
```

`secret:show` decrypts to an ignored file and never prints the value. Delete that plaintext as soon as
the consumer finishes:

```powershell
npm run secret:show -- dev/runtime/files/<name>.key
```

## Verify

```powershell
Test-Path .stacks\dev\runtime\files\<name>.key
Test-Path .stacks\dev\runtime\files\<name>.key.enc
git status --short
```

The plaintext check must be `False`, the encrypted check `True`, and only the intended `*.enc` file may
be staged. `npm run sync` must complete without publishing a value.

## Stop or rollback

If encryption fails, the tool deliberately leaves the plaintext so the value is not lost. Fix SOPS,
rerun the command, then prove the plaintext is gone. To abandon an uncommitted new record, remove only
the exact verified plaintext/encrypted target; never recursively clear `.stacks`.

## Rotate

1. Issue the replacement in the provider first.
2. Replace the fixed encrypted record with `secret:set`.
3. Replace every projection that consumes it (GitHub Secret, deployed secret store or server file).
4. Verify the new value in a non-destructive operation.
5. Revoke the old provider token last.

Datastore bootstrap credentials (PostgreSQL, Elasticsearch and Keycloak admin) are coupled to their
volumes. Do not rotate their files alone; follow the Local stack reset boundary.

## Troubleshoot

| Symptom | First check |
|---|---|
| `sops is not installed` | `winget install Mozilla.SOPS` and open a new shell |
| master identity missing | restore `%USERPROFILE%\.starci\master.identity` |
| no matching creation rule | run from repository root and verify `.sops.yaml` |
| app still reads an old value | rerun `npm run sync`; restart the app/container |
| `compose` reports a missing file | `npm run secret:gen -- dev`, then `npm run sync` |
| publisher reports no interactive terminal | set the named variable in that process or run it in an interactive terminal |
| one repository rejects a batch token | use that repository's own token; do not widen its scope locally |

## Upstream

- [SOPS](https://getsops.io/)
- [age](https://github.com/FiloSottile/age)
