---
name: environment
description: Which repo, which branch, which ports, where things are stored, and machine traps that have actually bitten. Read before touching a file or running a command.
---

# Environment

## Repo and branch

| Tree | Path | Note |
|---|---|---|
| FE app | `D:/Repositories/starci-academy` | branch `mtp` |
| Design system | `starci-academy/.storybook` | **the FE lane may only write here** |
| Backend | `D:/Repositories/starci-academy-backend` | branch `mtp`, holds this skill set |
| Canon private | `github.com/starci183/starci-claude-canon` | source of truth |
| Canon public | `github.com/starci183/starci-ai-design-system` | business-stripped version |

**`src/` is the building, `.storybook/` is the blueprint.** The FE lane reads `src` for anchors; it does not write to `src`.

## Ports

| Port | What it is | Use when |
|---|---|---|
| `8080` | `web-preview-8080` | presenting a full HTML mockup |
| `6006` | Storybook | **never drive it yourself** — isolated canvas, no real theme |
| `3000` | `web-preview` | **avoid** — may be running another chat session |

## Where things are stored

| Thing | Location |
|---|---|
| feedback session | `starci-academy/.artifacts/feedback/` |
| extracted business logic | `starci-academy/.artifacts/domain/INDEX.md` |
| audit state | `starci-academy/.artifacts/states/` |

## Machine traps that have actually bitten

**PowerShell 5.1 breaks UTF-8 encoding.** `Get-Content -Raw` reads a BOM-less UTF-8 file using the ANSI codepage, and `Set-Content -Encoding utf8` writes it back double-encoded — Vietnamese text turns to mojibake, and the command still reports success. When bulk-editing files with diacritics, **write an `.mjs` script and run it with `node`**. If forced to use PowerShell, use `[IO.File]::ReadAllText/WriteAllText` with `New-Object Text.UTF8Encoding($false)`.

**Regex on markdown: `\s` swallows `\n`.** `/\|\s*\|/g` also matches newlines, so it merges entire table rows into one line. To catch empty cells, use `[ \t]`.

**PowerShell character comparison is case-insensitive.** `'ã' -eq 'Ã'` returns `True`, so counting characters to detect mojibake with `-eq` gives wrong results. Use `-ceq`.

**Storybook's watcher hangs on Windows.** After editing a story file, kill and restart `:6006` — don't trust hot-reload.

**Turbopack caches `globals.css`.** If a token change doesn't show up, run `rm -rf .next`.

**Drive C: is nearly full**, and Docker takes up a lot of it. Be careful with heavy jobs.

## Automated gates

Ten gates plus `tsc --noEmit` and eslint. They cover **a small slice** of the 15 axes — see rule 2 in [`house-rules.md`](house-rules.md). A green gate is not a verdict.

The build deliberately turns off type-checking (BE drops ForkTsChecker, FE uses `ignoreBuildErrors`) — rely on `tsc --noEmit` and pre-commit instead. This is intentional, not a bug to fix.
