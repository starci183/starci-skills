---
title: Khởi tạo · workspaces
---

# Workspaces

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@pattern-reference-catalog` | `compilers/patterns/source-references/references.json` | file | gắn precedent FE/BE dùng chung vào immutable Git truth |
| `@pattern-reference-schema` | `readiness/initialization/workspaces/pattern-references.schema.json` | file | validate generated offline reference route |
| `@install-pattern-references` | `readiness/initialization/workspaces/install-pattern-references.mjs` | script | cài immutable ref dưới `.workspaces/local/references` |
| `@portable-route-schema` | `readiness/initialization/workspaces/portable-route.schema.json` | file | từ chối absolute path, observed head và secret-bearing portable declaration |
| `@workspace-portable` | `scripts/workspace-portable.mjs` | script | export declaration push được và hydrate local route đã verify một cách deterministic |

`.workspaces/config.json`, `.workspaces/projects/<project>/<role>.json` và `.workspaces/ports/*.json` là declaration
push được. Role declaration sở hữu GitHub URL không credential, expected branch, repository-relative directory và
context path, cùng grammar/profile rõ ràng. Nó không chứa absolute path, observed head, timestamp, credential hay
generated state.

`@workspace-portable hydrate` verify từng checkout đã khai rồi generate machine-local read route tại
`.workspaces/local/routes/<project>/<role>/config.json`. Route này sở hữu absolute path, observed Git head và thời
điểm verify. Checkout thiếu làm hydration dừng; clone là materialization riêng cần authorization rõ.

`.workspaces/local/pattern-references.json` và `.workspaces/local/references/<id>` là offline access generated tới
precedent FE/BE bất biến. Initialization reuse Git object local khi có, nếu không chỉ fetch catalog-pinned commit.
Pattern compiler validate và đọc các detached checkout này.

Portable port declaration giữ Source slot step, project offset và application slot. Initialization không copy
allocation ownership vào product repository.

Evidence là tracked declaration, immutable reference catalog và từng checkout fact đã resolve. Action chỉ hydrate
`.workspaces/local` và có thể cài immutable reference còn thiếu tại đó. Proof từ chối portable absolute path hoặc
secret-bearing value, rồi verify mọi generated remote, branch, head và path.
