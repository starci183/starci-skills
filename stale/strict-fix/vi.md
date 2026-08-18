---
title: Strict fix
---

# Strict fix

## Dấu hiệu stale

Strict-fix scope chứa direct Prettier package, config/ignore file, script, lint-staged entry, hook, CI step
hoặc editor setting trong khi installed ESLint canon sở hữu formatting.

## Evidence cho stale list

Chỉ inspect first-party integration point. Prose mention hoặc transitive lockfile dependency không phải
formatter ownership. Report mọi matching path và manifest field mà không chạy Prettier.

## Inventory cho repair

Inventory direct `prettier`, `eslint-plugin-prettier`, `eslint-config-prettier`, `prettier-plugin-*`,
`.prettierignore`, `.prettierrc*`, `prettier.config.*` và mọi first-party invocation. Exact set này cùng
manifest/lockfile là approval boundary.

## Apply

Bỏ toàn bộ integration trong một mechanical pass. Repoint format entrypoint còn cần sang installed ESLint
canon; bỏ entrypoint nếu chỉ duplicate lint. Regenerate lockfile qua package manager. Không xóa unrelated
package chỉ vì dependency tree của nó chứa Prettier.

## Proof

Không còn tracked Prettier config/ignore file, direct Prettier-family package hay first-party invocation/
editor selection. Mọi format command còn giữ resolve sang ESLint và pass. Giải thích lockfile-only
transitive match bằng dependency path của package manager.
