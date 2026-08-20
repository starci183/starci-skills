# Semantic badge machine

## LOADS

None.

The badge machine reads provider image URLs from a repository README, refuses credential-bearing URLs,
fetches each image and rejects error SVGs even when they return HTTP 200. Filesystem wiring and provider
truth remain separate evidence.

```text
node .claude/machines/badges/check.mjs <repository-root>
node --test .claude/machines/badges/check.spec.mjs
```
