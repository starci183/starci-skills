# A4 chạy khô 2 — `workspace.bind` trên `starci-academy/be`

Ngày 2026-09-02. Khai báo portable `.workspaces/projects/starci-academy/be.json`, route đã hydrate
`.workspaces/local/routes/starci-academy/be/config.json`, checkout `D:/Repositories/starci-academy-backend`
trên `mtp` ở `0b540dd2`, không tiêu thụ runtime, không hint, không receipt cache.

Cả hai artifact qua validator của operator; một bản làm hỏng `operatorId` bị chặn với thông điệp
`$.operatorId: expected "workspace.bind"`: [input.json](input.json), [output.json](output.json).

## Đã bind gì

| Ràng buộc | Giá trị | Lấy từ đâu |
| --- | --- | --- |
| Route portable | source, `https://github.com/starci-lab/starci-academy-backend`, `mtp` | đọc từ `be.json`, fingerprint là hash của file |
| Route đã hydrate | cùng kho và nhánh, disk path và git root đều là Source root, workspace root là `.workspaces` bên dưới | đọc từ `config.json`, fingerprint là hash của file |
| Checkout quan sát | `mtp`, head `0b540dd2` bằng head đã đóng băng, origin bằng kho đã khai | `git rev-parse`, `git branch --show-current`, `git remote get-url origin` |
| Đường dẫn bẩn | 75, trong đó 21 dưới `src/features/api/core` và 54 ở ngoài | `git status --porcelain` |
| Danh tính | máy `starci-academy-local-state-v1`, roster `.workspaces/local/credentials` (hai file `.key.enc`), không bao giờ đọc | các khoá trong `device-state.json` và một lần liệt kê thư mục |

## Kết quả

`blocked` · `CHECKOUT_DIRTY` · owning domain `source` · retry được.

Route phân giải sạch: khai báo portable và bản hydrate khớp nhau, head quan sát bằng head đóng băng,
nhánh đúng là nhánh sửa đổi. Checkout thì không sạch: 54 đường dẫn bẩn nằm ngoài write root duy nhất
mà một nhiệm vụ backend sẽ khai, và đó là phần Pro subscription, seeder, migration, socket chưa commit
cùng bốn file khai báo `.workspaces/projects/*`. Receipt gọi tên cả 54 làm subject.

## Phát hiện về cây skills, không phải về sản phẩm

1. **Mã lỗi không thể chạm tới.** `validate-input.mjs` từ chối mọi bản quan sát có đường dẫn bẩn
   ngoài write root như input sai, trong khi `execute.md` bước 5 và bảng lỗi hứa `CHECKOUT_DIRTY` cho
   đúng trường hợp đó. Checkout bẩn là một điều kiện của thế giới, không phải tài liệu sai dạng. Đã
   sửa ở `47d21798`: bản quan sát qua validator và operator trả lời bằng mã lỗi có kiểu; self-test phủ
   cả hai nửa.
2. **Cả hai khai báo trỏ vào schema v7.** `be.json` và `config.json` mang `$schema` dưới
   `.claude/readiness/initialization/workspaces/`, và route hydrate gọi `source.skills` là
   `.claude/skills`. Không đường dẫn nào tồn tại trong cây v8. Hai file vẫn phân giải được vì không gì
   đọc `$schema`; độ lệch thuộc về đợt cutover, không thuộc `workspace.bind`: `package.json` của backend vẫn
   chạy `.claude/scripts/workspace-portable.mjs`, `device-state.mjs` và `node --test .claude/scripts/*.spec.mjs`,
   tất cả đã rơi cùng v7. Đã khôi phục ở `8f645ee1` cùng năm file `readiness/initialization/workspaces/`,
   nên các liên kết `$schema` phân giải lại được và `workspace-portable.mjs check --source ..` xác thực cả
   mười route thật (báo hai route FE đã hydrate là cũ, điều này đúng).
3. **Hình dạng danh tính.** v8 bind một `credentialRosterRef` với `rosterEncrypted: true`. Workspace
   giữ từng khoá `.key.enc` dưới `.workspaces/local/credentials` và một `masterIdentity` trong
   `device-state.json`; thư mục được bind làm roster. Hoặc hợp đồng chấp nhận một thư mục khoá đã niêm
   phong theo tên, hoặc workspace mọc thêm một file roster. Còn mở.
4. **`authorityRoots` chưa được thử.** Route bị chặn trước khi được phát ra, nên trường `businesses`
   suy ra mới (`6aa4d3b8`) mới chỉ được self-test chứng minh. Tiền đề còn thiếu là một checkout sạch.

## Sự thật cho chủ sản phẩm

- Bảy mươi lăm đường dẫn đang bẩn trên `mtp`; năm mươi tư trong số đó nằm ngoài `src/features/api/core`.
- Bốn file khai báo `.workspaces/projects/*` bị sửa cùng lúc với source sản phẩm.

Lần chạy khô này không đổi gì.
