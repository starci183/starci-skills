# Bảng điều khiển chuyển đổi xoay vòng thông tin xác thực

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | credential-rotation-cutover-console |
| Family | settings |
| Dominant task | Xoay vòng một credential qua giai đoạn cũ/mới cùng hoạt động, chứng minh mọi consumer đã chuyển rồi mới vô hiệu hóa và hủy credential cũ. |
| Search aliases | credential-rotation-cutover-console; credential rotation cutover console |
| Authority | Topology tác vụ, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Xoay vòng một credential qua giai đoạn cũ/mới cùng hoạt động, chứng minh mọi consumer đã chuyển rồi mới vô hiệu hóa và hủy credential cũ.
- Mỗi vùng có một owner ngữ nghĩa; supporting context không chiếm dominant task.
- DOM order, reading order và focus order giữ nguyên ý nghĩa qua wide, intermediate và compact.
- Grammar cung cấp dữ kiện sản phẩm; Principles giải exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-CRC-01 | Xoay vòng một credential qua giai đoạn cũ/mới cùng hoạt động, chứng minh mọi consumer đã chuyển rồi mới vô hiệu hóa và hủy credential cũ. | tín hiệu dương bắt buộc |
| AR-CRC-02 | Mọi vùng bắt buộc và quan hệ quan trọng đều có owner độc lập. | tín hiệu dương bắt buộc |
| AR-CRC-03 | Quan hệ wide không còn hoạt động nhưng compact vẫn phải giữ task, state và recovery. | kích hoạt transformation |
| AR-CRC-90 | trang là checklist, dependency resolver, inventory credential, deployment monitor hoặc công cụ migrate từng hàng độc lập. | reject |
| AR-CRC-91 | Khác biệt chỉ là product noun, density, màu, component hoặc số lượng card. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-CRC-01 và AR-CRC-02 đều có bằng chứng, không có AR-CRC-90 hoặc AR-CRC-91, và region graph vẫn cần thiết ở cả ba topology. Nếu owner hoặc transformation chưa rõ, trả needs-evidence.

## Region graph

~~~text
rotation-console
├─ credential-identity-and-risk
├─ old-and-new-credential-state
├─ dependent-consumer-migration-ledger
├─ selected-consumer-proof
├─ overlap-window-and-cutover-controls
├─ global-verification-evidence
├─ disable-grace-and-destroy-transaction
└─ completion-receipt
~~~

Quan hệ quan trọng: Dual-live state, per-consumer proof, aggregate verification, grace, and irreversible destruction are separate gates.

### Nghĩa vụ vùng

| Region ID | Owner | Quan hệ bắt buộc |
|---|---|---|
| rotation-console | Sở hữu ranh giới dominant task của trang và chứa mọi region bắt buộc; không tự tạo semantic sản phẩm. | Chứa credential-identity-and-risk, old-and-new-credential-state, dependent-consumer-migration-ledger, selected-consumer-proof, overlap-window-and-cutover-controls, global-verification-evidence, disable-grace-and-destroy-transaction, completion-receipt nhưng giữ owner độc lập của từng region. |
| credential-identity-and-risk | Sở hữu dữ kiện ổn định về subject, scope và orientation cho mọi quyết định phía sau. | Định hướng old-and-new-credential-state mà không thay owner của nó. |
| old-and-new-credential-state | Sở hữu đúng task fact hoặc stage được đặt tên và không lấy authority của region lân cận. | Nhận context từ credential-identity-and-risk và ràng buộc dependent-consumer-migration-ledger mà không gộp authority. |
| dependent-consumer-migration-ledger | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ old-and-new-credential-state và ràng buộc selected-consumer-proof mà không gộp authority. |
| selected-consumer-proof | Sở hữu evidence truy nguyên được cùng trạng thái freshness, availability và permission. | Nhận context từ dependent-consumer-migration-ledger và ràng buộc overlap-window-and-cutover-controls mà không gộp authority. |
| overlap-window-and-cutover-controls | Sở hữu input hoặc lựa chọn hiện tại cùng trạng thái pending và recovery của nó. | Nhận context từ selected-consumer-proof và ràng buộc global-verification-evidence mà không gộp authority. |
| global-verification-evidence | Sở hữu evidence truy nguyên được cùng trạng thái freshness, availability và permission. | Nhận context từ overlap-window-and-cutover-controls và ràng buộc disable-grace-and-destroy-transaction mà không gộp authority. |
| disable-grace-and-destroy-transaction | Sở hữu transaction completion, verification hoặc recovery hữu hạn và chặn thực thi trùng. | Nhận context từ global-verification-evidence và ràng buộc completion-receipt mà không gộp authority. |
| completion-receipt | Sở hữu transaction completion, verification hoặc recovery hữu hạn và chặn thực thi trùng. | Nhận trạng thái đã verify từ disable-grace-and-destroy-transaction và phát outcome hoặc recovery path hữu hạn. |

## Responsive contract

### Wide

- Keep old/new states, consumer ledger, and global verification simultaneously comparable.
- Failure trigger: các vùng đồng thời làm hẹp nội dung, che trạng thái hoặc phá quan hệ owner.
- Navigation replacement: không cần nếu các vùng còn đồng hiện; sticky chỉ dành cho context vừa viewport.
- Overflow owner: page theo trục dọc; chỉ region có bản chất hai chiều mới own overflow có giới hạn.

### Intermediate

- Persist the dual-state summary, keep the ledger primary, and move selected proof into the temporary pane.
- Failure trigger: supporting persistence cạnh tranh measure hoặc focus với primary task.
- Navigation replacement: trigger có tên mở temporary pane, Escape đóng và focus trở đúng trigger.
- Sticky boundary tự yield ở short-height; page vẫn là overflow owner.

### Compact

- Stage rotation summary, each consumer proof, cutover, global verification, grace, destroy or recovery, then receipt.
- Failure trigger: nhiều pane không còn đồng thời operable với text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay quan hệ pane; Back giữ selection và draft.
- Không có page-level horizontal scroll; sticky/fixed surface không che content hoặc focus.

### Reflow

Thứ tự ngữ nghĩa theo region graph là DOM order và reading order ở mọi width. CSS không reorder. Text, localization, zoom và spacing growth làm vùng cao hơn hoặc chuyển topology; không clip nội dung. Trạng thái trong vùng giữ nguyên khi vùng được chuyển vào hoặc ra temporary pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và kết quả. Status động được announce qua polite live region mà không tự cướp focus. Dialog giữ focus, hỗ trợ Escape/cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Danh mục trạng thái domain (giữ stable state identifiers để EN/VI/context đồng nhất): preparing; old-only; new staged; dual-active; consumer pending/migrated/failed/unknown; overlap expiring; verification running/partial/pass/fail; cutover conflict; disabled/grace; pre-destruction cutback; destroy locked/pending/failed/irreversible; forward rotation; completion receipt.

| State family | Obligation | Focus transition | Responsive presentation |
|---|---|---|---|
| initial/loading | Giữ anatomy đã biết và nêu vùng đang chờ. | Không tự chuyển focus. | Giữ cùng stage identity. |
| ready | Hiển thị dữ liệu demo nhất quán và product-neutral. | Focus ở control đã kích hoạt. | Giữ selection. |
| empty/not-applicable | Nêu vì sao trống và bước tiếp theo nếu có. | Focus đến recovery chỉ khi cần tiếp tục. | Không xóa vùng bắt buộc khác. |
| error/retry | Gắn lỗi với owner và cung cấp retry có giới hạn. | Multi-error chuyển đến summary; retry trả đúng owner. | Lỗi không chỉ thể hiện bằng màu. |
| permission/unavailable | Giữ orientation và giải thích giới hạn. | Không focus control bị khóa. | Cùng lý do ở mọi topology. |
| pending | Chặn duplicate và giữ label hành động có nghĩa. | Không cướp focus để báo tiến độ. | Trạng thái đi cùng action owner. |
| success | Xác nhận kết quả và continuation hợp lệ. | Chỉ chuyển focus khi giúp tiếp tục. | Không tạo source of truth thứ hai. |
| stale/conflict | Nêu phiên bản thay đổi và giữ input an toàn. | Focus đến lựa chọn recovery có ngữ cảnh. | Selection sống qua transformation. |
| domain states | Alpha migrated to the new credential with textual proof. Beta migrated; every known consumer now has proof. Aggregate verification passed across all consumers; disable is unlocked. Old credential disabled in grace; cutback remains available before destruction. Old credential destroyed irreversibly; recovery now requires forward rotation. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Chấp nhận khi dominant task cần đúng region graph, quan hệ quan trọng tạo topology riêng và cả ba responsive state giữ được task/recovery parity.

### Từ chối

Từ chối khi trang là checklist, dependency resolver, inventory credential, deployment monitor hoặc công cụ migrate từng hàng độc lập, hoặc khi chỉ đổi noun/card/density của archetype khác.

### Phán quyết ranh giới

Kết quả hợp lệ là accept, reject, duplicate-or-variation hoặc needs-evidence theo quy tắc Situation codes; không suy diễn bằng cảm tính.

## Bàn giao

- Grammar nhận dữ kiện thật, semantic owner, permission, trạng thái và hậu quả action.
- Principles nhận exact grid, measure, gap, sizing, alignment, overflow, threshold, sticky offset và focus accommodation.
- Direction nhận visual character; template chỉ là một realization conforming.

## Bằng chứng research không ràng buộc

### Ranh giới bằng chứng

Các nguồn sau là bằng chứng tư vấn chính thức đã kiểm tra. Chúng không phải product truth, không đặt tên archetype này cho tổ chức nguồn và không tự cấp quyền copy geometry, component tree, noun hoặc breakpoint.

### Nguồn

| Source | What it supports | What it does not prove |
|---|---|---|
| [Google Cloud — Secret Manager rotation recommendations](https://docs.cloud.google.com/secret-manager/docs/rotation-recommendations) | Hỗ trợ rotation schedule and operational separation. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [NIST SP 800-57 Part 1 Rev. 5](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-57pt1r5.pdf) | Hỗ trợ key lifecycle and destruction risk. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Tables tutorial](https://www.w3.org/WAI/tutorials/tables/) | Hỗ trợ semantic association for tabular consumer evidence. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |

## Đầu ra

~~~json
{
  "archetypeId": "credential-rotation-cutover-console",
  "matchedSituationCodes": [
    "AR-CRC-01",
    "AR-CRC-02"
  ],
  "aliases": [
    "credential-rotation-cutover-console",
    "credential rotation cutover console"
  ],
  "dominantTask": "Rotate one credential through old/new overlap, prove every consumer migrated, then disable and irreversibly retire the old credential.",
  "regions": [
    "rotation-console",
    "credential-identity-and-risk",
    "old-and-new-credential-state",
    "dependent-consumer-migration-ledger",
    "selected-consumer-proof",
    "overlap-window-and-cutover-controls",
    "global-verification-evidence",
    "disable-grace-and-destroy-transaction",
    "completion-receipt"
  ],
  "relationships": [
    "Dual-live state, per-consumer proof, aggregate verification, grace, and irreversible destruction are separate gates."
  ],
  "responsive": {
    "wide": "Keep old/new states, consumer ledger, and global verification simultaneously comparable.",
    "intermediate": "Persist the dual-state summary, keep the ledger primary, and move selected proof into the temporary pane.",
    "compact": "Stage rotation summary, each consumer proof, cutover, global verification, grace, destroy or recovery, then receipt.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "interactionParity": "Every action, state, recovery path, and focus return remains available across bands."
  },
  "stateObligations": [
    "initial/loading",
    "ready",
    "empty/not-applicable",
    "error/retry",
    "permission/unavailable",
    "pending",
    "success",
    "stale/conflict",
    "focus transition"
  ],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [
    "product facts",
    "semantic owners",
    "real state transitions"
  ],
  "principlesHandoff": [
    "exact geometry",
    "measure and overflow",
    "content-driven thresholds",
    "focus accommodation"
  ],
  "confidence": "low",
  "evidenceClasses": [
    "official task-domain guidance",
    "official design-system guidance",
    "accessibility guidance"
  ]
}
~~~

Không trả class, token, component, đường dẫn source, breakpoint cố định hoặc dữ kiện sản phẩm tự bịa.
