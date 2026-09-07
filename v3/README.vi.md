# Hướng dẫn runtime Work 3.0

Alpha cục bộ. Runtime gồm validator/CLI tra cứu và contract op cho agent; không phải scheduler, browser adapter, secret manager hay dịch vụ deploy. [README.md](README.md) là authority.

Mỗi prompt chọn preset/mode từ [catalogue skill](../skills/catalog.json) theo scope `.work`, dùng recipe cố định, không tự sáng tác workflow. Mọi skill/retry/worker dùng chung tối đa 3 lớp × 3 invocation đồng thời, không reset. Chỉ làm phần request cho phép, kiểm chứng prerequisite, bàn giao phần còn lại. Đây là contract agent, không phải CLI engine; không duyệt lại bước đã cho phép.

## Nguồn chuẩn và nơi lưu

Chọn ID từ [catalogue](ops/catalog.json), đọc đúng document và commonDocument. [Core](core/README.md) cùng schemas định nghĩa trường máy và giới hạn kiểm tra.

- `.work/workspace.yaml`: ID workspace.
- `.work/<business>/**/node.md`: cây completion; trạng thái ở lá, cha tính từ con.
- `.work/_resources/<category>/<slug>/resource.yaml`: repo/environment/account/fixture/contract/design/storage dùng chung, chỉ ref tới nguồn canonical.
- `evidence/<id>/manifest.yaml` và assets tại node/flow: bằng chứng thực tế.
- `_local`: scratch/cache, không track. Không đưa credential, browser storageState hay config giải mã vào evidence.

Metadata alpha dùng cú pháp JSON trong file YAML và front matter giữa hai dòng `---`; phần mô tả là Markdown. JSON là tập con tương thích YAML; YAML tùy ý chưa được hỗ trợ và phải báo lỗi rõ. Không viết parser đoán nghĩa. Dùng schema thực tế cho completion, không suy ra field từ ví dụ.

## Lệnh

Chạy `node bin/starci-skills.mjs work ...` ở source; bản đã cài dùng `node .claude/bin/starci-skills.mjs work ...`.

| Sau work | Tác dụng |
| --- | --- |
| `init <root-moi> --id <workspace-id>` | Chỉ tạo root mới tối thiểu, không sửa root có sẵn. |
| `ops` / `op <id>` | Xem catalogue/contract; không chạy op. |
| `validate <root>` / `tree <root>` | Đọc và kiểm tra/hiển thị completion; không auto-run. |
| `impact <root> <node-or-resource-id>` | Xem ảnh hưởng theo dependency; không cấp quyền chạy lại. |
| `audit-legacy <root-cu>` | Inventory chỉ đọc, không import verdict, chạy script hoặc đọc secret. |

Không có cook/approve/done/spawn/retry/deploy/migrate CLI. Agent thực hiện op bằng tool có thật và quyền user đã cho; cập nhật file bằng công cụ chỉnh sửa được phép rồi kiểm tra/commit.

## Hoàn thành và chứng cứ

Lá lưu todo/doing/blocked/done/na/suspended. Suspended khai báo cần suspensionReason không rỗng, dùng cho import từ code chưa xác minh intent/acceptance, không bịa completion cũ. Piece đã done mà input đổi/mất prerequisite thì effective suspended; giữ completion/evidence cũ, không sửa digest để giả retest. Fail/not-run/inconclusive không là pass; deferred/optional vẫn hiển thị.

Một bundle có thể chứng minh nhiều assertion, không copy ảnh khắp nơi. Giữ requirement IDs, actual outcomes, source/integrated commits, bản thực phục vụ, environment/account/fixture và asset hash. Không sửa expected theo actual lỗi.

SHA không chứng minh Git object còn tồn tại hoặc server đang chạy nó. Có ảnh không chứng minh nội dung ảnh đúng assertion. Vẫn phải đọc output tool và review thực tế. Core công bố đúng mức kiểm tra; chưa tự chứng nhận blob remote hay kind không biết.

Ảnh đã lọc nhạy cảm có thể track Git; artifact lớn cần storage bền, owner/hash/quyền/retention. Alpha chưa quản lý vault/LFS/provider hoặc tự tải blob remote. Quét field/pattern không thay kiểm tra toàn diện secret/PII.

## Mở rộng và nâng cấp

Scope và dependency graph thuộc `.work`, không phải chain của op. `dependsOn` tham chiếu node phải thực sự done trước khi piece đủ điều kiện; N/A không chứng minh module/account đã tồn tại. `refs` gắn input ngữ nghĩa để invalidation, không bắt thứ tự thực hiện.

Ví dụ scope được duyệt có thể là `art direction -> UI design -> FE -> UAT giao diện`, còn BE không phụ thuộc art direction thì giữ nguyên. Scope khác có `module -> account`, `module + account -> chat`. Đây không phải chain bắt buộc mọi business. Dùng stable ID cả khi nối hai business; thiếu ID hoặc có vòng thì báo lỗi, không tự bịa prerequisite.

Resource thiết kế có thể khai báo `files:[{path}]` tương đối dưới thư mục resource: core hash byte thật của input cục bộ. Đổi ảnh thiết kế làm input consumer đổi dù chưa bump revision bằng tay. Code/runtime/remote resource vẫn phải refresh từ owner thật, core không tự theo dõi endpoint. Node đã hoàn thành bị ảnh hưởng chuyển suspended nhiều tầng; phần không liên quan không bị reset.

Op đọc graph và làm đúng node được giao. Sửa graph là scope update phải được chọn riêng; không tự bỏ deps cho pass, gọi successor hay chạy lại cả cây. Ảnh thiết kế là input khác với screenshot UAT là evidence: sửa screenshot cũ làm hỏng bằng chứng, không tự trở thành yêu cầu redesign.

Thêm mobile/security/a11y/migration/release/operations bằng cùng kiểu node; ID không phụ thuộc tên folder. Kind mới giữ dữ liệu nhưng cần profile được hỗ trợ trước verified done. Không tạo progress database hay bảng trạng thái cha thủ công.

Resource có một owner/version; consumer tham chiếu, không copy account/fixture. Nhiều host cần coordination/serialize; Git/file local không bảo vệ runtime khỏi race. Parallel phải được yêu cầu/duyệt và tách scope ghi, session, mutable data.

Đã bỏ V2 alias/routing/workflows/scripts/contracts và Lite; tra lịch sử bằng Git, không fallback. Tên cũ trong guard/test bảo vệ ownership, không là storage contract. Receipt cũ không tự done. Upgrade-major chỉ xóa file runtime nghỉ còn nguyên có manifest ownership; giữ file sửa/unowned/dữ liệu/Git. Init bản quản lý dùng update. Bootstrap conflict dừng trước ghi; no-bootstrap không được bỏ Lite khi entry còn cần nó. Không tự cấp quyền migrate sản phẩm.

Migration riêng phải inventory tracked/untracked/ignored/nested Git; giữ commit/ảnh/secret custody; map một business và thử checkout sạch; cutover một writer. Không xóa folder vì tên trông tạm.

## Kiểm tra

npm test chạy fixture V3 và installer relocate. Doctor quick chạy core/ops/presets; full thêm CLI/acceptance. Không test account/server/browser sản phẩm thật. Không legacy test command hoặc executable fallback.
