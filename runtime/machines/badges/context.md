# Semantic badge machine

## LOADS

None.

The badge machine reads provider image URLs from a repository README. Public projects use direct
token-free images. A private project may use a provider-issued, project-scoped read-only `token` only on
the provider's official badge image endpoint. Upload, scan, API and admin credentials — and tokens on any
other URL — are refused. Token values are redacted from machine output. The machine fetches each image and
rejects error SVGs even when they return HTTP 200. Filesystem wiring and provider truth remain separate
evidence.

```text
node .claude/runtime/machines/badges/check.mjs <repository-root>
node --test .claude/runtime/machines/badges/check.spec.mjs
```
