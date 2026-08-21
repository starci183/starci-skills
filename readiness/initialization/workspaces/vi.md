---
title: Khởi tạo · workspaces
---

# Workspaces

## LOADS

None.

`.workspace/config.json` sở hữu một `defaultLang` chung cho Source. Mỗi project role đã khai sở hữu một
read route `.workspace/<project>/<role>/config.json`. Project và role phải do owner khai, không suy ra từ
tên thư mục hay lượt chạy trước.

`.workspace/ports/config.json` sở hữu slot step chung của Source, còn mỗi
`.workspace/ports/<project>.json` sở hữu family offset cùng application slot map bền. Khi project đã khai
bind local service, initialization tạo hoặc validate project-named allocation record trước khi route được
reuse. Nó không copy offset vào target repository và không sửa target.

Verify checkout, repository, branch/head, manifest và vị trí contract thật trước khi phân loại route là
`create`, `reuse`, hoặc `refresh`. Contract chỉ là `null` khi repository thật sự không có. Ghi `grammar`
và `grammarProfile` thành một cặp rõ ràng: cùng `null`, hoặc cùng resolve tới đúng grammar authority package và
profile. Không suy ra chúng từ tên project hay repository. Route là mô tả
machine-local: không clone, mirror, mount hay sửa target, và không chứa credential hoặc environment value.

Evidence là shared config, port allocation, mọi role record và từng checkout fact đã resolve. Action chỉ ghi hoặc refresh
các local route record đó. Proof parse lại từng record và resolve mọi path đã khai; in `written`,
`refreshed`, hoặc `reused` cho từng route.
