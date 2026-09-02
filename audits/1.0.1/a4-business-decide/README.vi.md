# A4 chạy khô 1 — `business.decide` trên `pro-subscription`

Ngày 2026-09-02. Head backend `0b540dd2` (working tree đang bẩn). Businesses root là
`starci-academy-backend/.worktrees/businesses`, một git worktree riêng trên nhánh
`codex/businesses/starci-academy`. Mục tiêu: revise lời hứa Pro subscription từ head `pending` sang
`in-progress`.

Cả hai artifact qua validator của operator; một bản làm hỏng `operatorId` bị chặn với thông điệp
`$.operatorId: expected "business.decide"`, nên màu xanh này là đo được: [input.json](input.json),
[output.json](output.json).

## Đã bind gì

| Ràng buộc | Giá trị | Lấy từ đâu |
| --- | --- | --- |
| Head source backend | `0b540dd21e250a346e6206c70225849cc31ead8e` | `git rev-parse HEAD` |
| Head nghiệp vụ | `sha256:eccaeaad…` trạng thái `pending` | `business-registry-v1.json` → `featureHeads.pro-subscription.head`, `authorityStatus` |
| Claim `fact` | 8, mỗi cái có đường dẫn và khoảng dòng đọc từ `git show HEAD:<path>` | đối soát idempotent và nhánh unpaid, quyết định reconcile, dispatch grant, ba consumer gate theo membership, quota AI |
| Claim `unknown` | 5, `sourceHead: null` | cửa offer, cửa đọc, mua, hết hạn, hủy: tất cả nằm trong thư mục chưa track |
| Consumer đã phát hiện | 7 | AI entitlement, chat toàn cục, quota cộng đồng, gate blog, worker đối soát, checkout khóa học, hoàn tiền khóa học |
| Nhánh vòng đời | expiry, cancellation, recovery, legacy-settle | từ mục `states` và `migration` của head |

## Kết quả

`blocked` · `EVIDENCE_MISSING` · owning domain `backend` · retry được.

Mọi enforcement riêng của Pro chỉ nằm trong ba thư mục chưa track
(`mutations/pro-subscription/`, `queries/pro-subscription/`, `modules/bussiness/pro-subscription/`),
nên không claim `fact` nào bind được vào head, mà claim `fact` không có head là input sai theo chính
luật của operator. Ở head đã bind, `grantForTransaction` chỉ dispatch `AiSubscriptionPurchase`,
`MembershipPurchase` và `Enroll`; ba consumer entitlement tìm thấy đều đọc
`membershipService.isActive`, không đọc Pro subscription. Lời hứa mà head mô tả vì thế chưa được
source đã commit nào thực thi, đúng kiểu "đúng ở offer, sai ở guard" mà operator sinh ra để từ chối.

## Phát hiện về cây skills, không phải về sản phẩm

1. **Layout head bị lệch.** Hợp đồng v8 ghim `businessesRootRef` vào `…/.worktrees/businesses` và
   đòi head nằm đúng `<root>/<featureId>`, một bậc phẳng. Root thật lưu
   `features/<featureId>/model.json`, kho `objects/sha256/` đánh địa chỉ theo nội dung, bản đồ head
   `business-registry-v1.json`, và `history/by-id.json`. Mười bốn feature đã sống theo hình dạng đó.
   Hợp đồng được viết mà chưa đọc root; root mới là thẩm quyền, nên hợp đồng, hai schema và self-test
   phải theo `features/<featureId>` và dùng registry làm chỉ mục head. Trước đó, mọi lần chạy thật đều
   mang một `headRef` qua validator nhưng không tồn tại.
2. **Không ai sở hữu việc tìm root.** `workspace.bind` bind route, checkout, chính sách git, write
   roots và runtime; không gì trong v8 sinh ra `businessesRootRef`. Giá trị trong input này là gõ tay.
   Hoặc route mọc thêm `businessesRootRef` suy từ checkout backend, hoặc `business.decide` tự suy từ
   `gitRoot` đã route; một trong hai phải sở hữu.
3. **Thẩm quyền đánh địa chỉ theo nội dung bind được dù chưa commit.** Head nghiệp vụ đang chưa
   track trong worktree của nó (`?? features/pro-subscription/`, `?? objects/sha256/eccaeaad…`), nhưng
   hash nội dung là fingerprint thật nên `context.authority` bind sạch. Fact từ source không làm thế
   được, vì khoảng dòng vô nghĩa khi không có commit. Sự bất đối xứng này đúng và đáng ghi vào
   `context.md`.

## Đã đóng sau lần chạy này

Phát hiện 1 đóng bởi `3aaada85`: hợp đồng, hai validator và self-test gọi head tại
`features/<featureId>`; `input.json` và `output.json` ở đây đã mang hình dạng đó và qua validator của
package đang sống. Phát hiện 2 đóng bởi `6aa4d3b8`: `workspace.bind` suy ra
`route.authorityRoots.businesses` từ checkout và từ chối giá trị gõ tay lệch với nó. Phát hiện 3 đã
được nêu trong `business.decide/context.md` qua phần mô tả registry.

## Sự thật cho chủ sản phẩm

- Phần backend của Pro subscription chưa commit trên `mtp`: ba thư mục mới cộng sửa đổi ở worker đối
  soát, grant service, AI entitlement, chính sách chat, quota cộng đồng và gate blog.
- Head nghiệp vụ Pro chưa commit trong worktree businesses, cùng head `course-advisor`,
  `course-community` và hai object; registry và history đang bị sửa.
- Ở head `0b540dd2` không consumer đã commit nào cấp gì dựa trên Pro subscription.

Lần chạy khô này không đổi gì.
