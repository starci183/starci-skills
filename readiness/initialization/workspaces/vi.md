---
title: Khởi tạo · workspaces
---

# Workspaces

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@pattern-reference-catalog` | `compilers/patterns/source-references/references.json` | file | gắn precedent FE/BE dùng chung vào Git truth bất biến |
| `@pattern-reference-schema` | `readiness/initialization/workspaces/pattern-references.schema.json` | file | validate route reference offline portable của Source |
| `@install-pattern-references` | `readiness/initialization/workspaces/install-pattern-references.mjs` | script | reuse Git object cục bộ hoặc cài immutable ref còn thiếu dưới `.workspace/references` |

`.workspace/config.json` sở hữu một `defaultLang` chung cho Source. Mỗi project role đã khai sở hữu một
read route `.workspace/<project>/<role>/config.json`. Project và role phải do owner khai, không suy ra từ
tên thư mục hay lượt chạy trước.

`.workspace/pattern-references.json` sở hữu route `workspacePath` portable tới precedent FE/BE bất biến
đã khai trong `@pattern-reference-catalog`. Initialization luôn materialize independent detached checkout
tại `.workspace/references/<id>`. Nó reuse Git object từ checkout đã route nếu có, nếu không thì fetch
immutable commit đã khai. Pattern compiler chỉ validate và đọc các offline checkout này; route thiếu hoặc
stale trả `needs-init`.

`.workspace/ports/config.json` sở hữu slot step chung của Source, còn mỗi
`.workspace/ports/<project>.json` sở hữu family offset cùng application slot map bền. Khi project đã khai
bind local service, initialization tạo hoặc validate project-named allocation record trước khi route được
reuse. Nó không copy offset vào target repository và không sửa target.

Verify checkout, repository, branch/head, manifest và vị trí contract thật trước khi phân loại route là
`create`, `reuse`, hoặc `refresh`. Contract chỉ là `null` khi repository thật sự không có. Ghi `grammar`
và `grammarProfile` thành một cặp rõ ràng: cùng `null`, hoặc cùng resolve tới đúng grammar authority package và
profile. Không suy ra chúng từ tên project hay repository. Route là mô tả
machine-local: không clone, mirror, mount hay sửa target, và không chứa credential hoặc environment value.

Evidence là shared config, immutable reference catalog, pattern-reference route portable, port allocation,
mọi role record và từng checkout fact đã resolve. Action chỉ ghi hoặc refresh các local route record đó và
có thể cài immutable reference còn thiếu dưới `.workspace/references`. Proof parse mọi record rồi verify lại
remote, commit và path; in `installed`, `written`, `refreshed`, hoặc `reused` cho từng route.
