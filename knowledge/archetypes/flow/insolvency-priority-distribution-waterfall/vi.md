# Insolvency Priority Distribution Waterfall

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `insolvency-priority-distribution-waterfall` |
| Family | Flow |
| Dominant task | Phân bổ một khối tài sản phá sản qua các nhóm tài sản bị ràng buộc và các khoản yêu cầu đã được công nhận theo thứ tự ưu tiên do tòa phê chuẩn, gồm phân bổ theo tỷ lệ trong cùng lớp, dự phòng, thiếu hụt và phản đối. |
| Search aliases | `insolvency estate distribution`, `claim priority waterfall`, `encumbered pool allocation`, `pari passu claims` |
| Authority | Bản ghi này quy định topology vĩ mô dùng chung, trung lập với sản phẩm. |

### Invariants

- Nhiệm vụ trội không đổi: Phân bổ một khối tài sản phá sản qua các nhóm tài sản bị ràng buộc và các khoản yêu cầu đã được công nhận theo thứ tự ưu tiên do tòa phê chuẩn, gồm phân bổ theo tỷ lệ trong cùng lớp, dự phòng, thiếu hụt và phản đối.
- Đồ thị vùng bắt buộc không đổi: `insolvency-distribution → proceeding-estate-date-and-court-order-version → asset-pool-and-encumbrance-register ↔ admitted-disputed-contingent-and-subordinated-claim-register → bipartite-claim-to-encumbered-pool-edges → available-estate-by-pool → pool-specific-priority-and-within-class-pro-rata → cross-pool-deficiency-surplus-and-reserve-ledger → objection-order-and-recalculation → approved-payment-schedule-and-closure-receipt`.
- Đồ thị hai phía từ yêu cầu đến nhóm cho phép yêu cầu và quyền bảo đảm được quản trị chạm nhiều nhóm mà không làm khối tài sản sụp thành một waterfall duy nhất.
- DOM order, reading order và meaningful focus order luôn giống nhau.
- Grammar sở hữu semantic sản phẩm; Principles sở hữu geometry chưa giải; Direction sở hữu visual character.
- Wide, intermediate và compact giữ action, state, keyboard access, overflow ownership và recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-IW-01` | Nhiệm vụ trội là kết quả chính của trang. | Bằng chứng ứng viên. |
| `AR-IW-02` | Mọi vùng bắt buộc và quan hệ được đặt tên đều hiện diện. | Bằng chứng bắt buộc. |
| `AR-IW-03` | Wide, intermediate và compact dùng đúng chuyển đổi topology đã khai báo. | Bằng chứng bắt buộc. |
| `AR-IW-04` | Compact giữ mọi action, state, đường bàn phím và recovery. | Bằng chứng bắt buộc. |
| `AR-IW-05` | Mẫu tương tác chứng minh acceptance focus của prompt. | Bằng chứng bắt buộc. |
| `AR-IW-90` | bridge-contribution-waterfall-overview | Loại. |
| `AR-IW-91` | multi-creditor-hardship-plan-negotiator | Loại. |
| `AR-IW-92` | waitlist-offer-allocation-board | Loại. |
| `AR-IW-93` | constrained-quota-allocation-editor | Loại. |
| `AR-IW-94` | single-pool tier list | Loại. |

### Selection rule

Chọn `insolvency-priority-distribution-waterfall` chỉ khi các mã 01–05 được chứng minh và không có mã 9*. Trả `needs-evidence` khi chưa rõ owner hoặc quan hệ; trả `reject` khi có bằng chứng loại; khác biệt chỉ ở noun, density, color, card count, component hoặc state là `duplicate-or-variation`.

## Region graph

```text
insolvency-distribution
   `-- proceeding-estate-date-and-court-order-version
      `-- asset-pool-and-encumbrance-register
         `-- admitted-disputed-contingent-and-subordinated-claim-register
            `-- bipartite-claim-to-encumbered-pool-edges
               `-- available-estate-by-pool
                  `-- pool-specific-priority-and-within-class-pro-rata
                     `-- cross-pool-deficiency-surplus-and-reserve-ledger
                        `-- objection-order-and-recalculation
                           `-- approved-payment-schedule-and-closure-receipt
```

Biểu thức quan hệ đã khai báo: `insolvency-distribution → proceeding-estate-date-and-court-order-version → asset-pool-and-encumbrance-register ↔ admitted-disputed-contingent-and-subordinated-claim-register → bipartite-claim-to-encumbered-pool-edges → available-estate-by-pool → pool-specific-priority-and-within-class-pro-rata → cross-pool-deficiency-surplus-and-reserve-ledger → objection-order-and-recalculation → approved-payment-schedule-and-closure-receipt`.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `insolvency-distribution` | Sở hữu nhiệm vụ trội, context phiên bản và recovery của mọi hậu duệ. | Là gốc của đồ thị và không thể bị thay bằng container chung. |
| `proceeding-estate-date-and-court-order-version` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `asset-pool-and-encumbrance-register` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `admitted-disputed-contingent-and-subordinated-claim-register` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `bipartite-claim-to-encumbered-pool-edges` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `available-estate-by-pool` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `pool-specific-priority-and-within-class-pro-rata` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `cross-pool-deficiency-surplus-and-reserve-ledger` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `objection-order-and-recalculation` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `approved-payment-schedule-and-closure-receipt` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ được nhãn đọc được, liên kết rõ, action thấy được và focus không bị che.
- **Topology response:** Asset pools, claims, lien and class mappings, pool waterfalls, distributions, and objections remain simultaneously visible.
- **Navigation replacement:** Không thay thế khi mọi owner bắt buộc còn dùng đồng thời.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được sticky; nó giữ chỗ và trở về in-flow khi chiều cao ngắn.
- **Overflow owner:** `admitted-disputed-contingent-and-subordinated-claim-register` Chỉ vùng đã khai báo sở hữu overflow có giới hạn; nội dung thường không tạo cuộn ngang toàn trang.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng persistent ưu tiên thấp nhất phá quan hệ trội.
- **Topology response:** The selected pool and active priority class remain primary; full claims, order evidence, and payment history move to synchronized disclosures.
- **Navigation replacement:** Disclosure hoặc drawer đồng bộ có tên thay vùng bị dời và trigger nêu trạng thái hiện tại.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được sticky; nó giữ chỗ và trở về in-flow khi chiều cao ngắn.
- **Overflow owner:** `admitted-disputed-contingent-and-subordinated-claim-register` Chỉ vùng đã khai báo sở hữu overflow có giới hạn; nội dung thường không tạo cuộn ngang toàn trang.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai owner đồng thời không thể giữ bằng chứng đọc được và control 44×44 CSS px.
- **Topology response:** Estate and order version → pool → encumbrance → priority class → claim and pro rata share → reserve or deficiency → objection effect → approved payment becomes a numeric sequence.
- **Navigation replacement:** Một chuỗi primary-pane với Previous và Next giữ selection, query, state và scroll context.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được sticky; nó giữ chỗ và trở về in-flow khi chiều cao ngắn.
- **Overflow owner:** `admitted-disputed-contingent-and-subordinated-claim-register` Chỉ vùng đã khai báo sở hữu overflow có giới hạn; nội dung thường không tạo cuộn ngang toàn trang.

### Reflow

- Semantic order và DOM order là `insolvency-distribution → proceeding-estate-date-and-court-order-version → asset-pool-and-encumbrance-register → admitted-disputed-contingent-and-subordinated-claim-register → bipartite-claim-to-encumbered-pool-edges → available-estate-by-pool → pool-specific-priority-and-within-class-pro-rata → cross-pool-deficiency-surplus-and-reserve-ledger → objection-order-and-recalculation → approved-payment-schedule-and-closure-receipt`.
- Text zoom, bản dịch dài và control phóng to kích hoạt cùng các topology change đã đặt tên.
- CSS không reorder nội dung thị giác khỏi keyboard order hoặc assistive-technology order.
- Label dài được wrap và detail ẩn có reveal rõ ràng, accessible.

### Interaction parity

- Mọi selection, edit, action, explanation, retry và recovery ở wide vẫn tới được tại intermediate và compact.
- Topology change giữ entity đã chọn, phiên bản, pending state, validation result và recovery point.
- Dynamic update dùng contextual status message mà không dời focus.
- Color, position, geometry và motion có tương đương bằng text hoặc cấu trúc.

## State obligations

| State | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `proceeding-estate-date-and-court-order-version` | Xác định scope đang chờ và giữ semantic position. |
| Ready | `asset-pool-and-encumbrance-register` | Bộc lộ đầy đủ nhiệm vụ trội và phiên bản hiện tại. |
| Empty / not applicable | `admitted-disputed-contingent-and-subordinated-claim-register` | Phân biệt vắng mặt có ý nghĩa với bằng chứng không khả dụng. |
| Error / retry | `bipartite-claim-to-encumbered-pool-edges` | Giữ context hợp lệ và cho retry cục bộ không reset selection. |
| Permission / unavailable | `available-estate-by-pool` | Không ngụ ý bằng chứng bị hạn chế là không tồn tại; cung cấp route an toàn. |
| Pending | `pool-specific-priority-and-within-class-pro-rata` | Ngăn action lặp và announce tiến độ mà không dời focus. |
| Success | `cross-pool-deficiency-surplus-and-reserve-ledger` | Bộc lộ outcome, provenance và action hợp lệ tiếp theo. |
| Stale / conflict | `objection-order-and-recalculation` | Giữ giá trị an toàn cuối và yêu cầu reconciliation rõ. |
| Focus transition | `approved-payment-schedule-and-closure-receipt` | Chỉ dời focus tới error summary bắt buộc; sau recovery trả đúng trigger. |
| Responsive presentation | `approved-payment-schedule-and-closure-receipt` | Giữ entity, query, state và recovery khi topology đổi. |
| estate estimated/realized | `proceeding-estate-date-and-court-order-version` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| asset unencumbered/encumbered/disputed | `asset-pool-and-encumbrance-register` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| claim filed/admitted/disputed/contingent/subordinated/rejected | `admitted-disputed-contingent-and-subordinated-claim-register` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| class open/partially paid/satisfied/deficient | `bipartite-claim-to-encumbered-pool-edges` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| distribution provisional/approved/paid | `available-estate-by-pool` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| reserve held/released | `pool-specific-priority-and-within-class-pro-rata` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| objection open/sustained/overruled | `cross-pool-deficiency-surplus-and-reserve-ledger` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| order current/amended/appealed | `objection-order-and-recalculation` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| proceeding open/closed/reopened | `approved-payment-schedule-and-closure-receipt` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |

## Boundaries

### Accept

- Chỉ accept khi nhiệm vụ trội biến đổi bằng chứng bắt buộc thành outcome khai báo.
- Chỉ accept khi mỗi vùng có owner độc lập và quan hệ vẫn rõ.
- Có đồ thị hai phía từ yêu cầu đến nhóm tài sản bị ràng buộc, trạng thái yêu cầu được công nhận, ưu tiên riêng theo nhóm, phân bổ pari passu trong lớp, hiệu ứng thiếu hụt và dự phòng xuyên nhóm, phiên bản lệnh tòa và phân bổ được phê duyệt.

### Reject

- Loại `bridge-contribution-waterfall-overview`; đây là bằng chứng `AR-IW-90` và phải route sang archetype liền kề.
- Loại `multi-creditor-hardship-plan-negotiator`; đây là bằng chứng `AR-IW-91` và phải route sang archetype liền kề.
- Loại `waitlist-offer-allocation-board`; đây là bằng chứng `AR-IW-92` và phải route sang archetype liền kề.
- Loại `constrained-quota-allocation-editor`; đây là bằng chứng `AR-IW-93` và phải route sang archetype liền kề.
- Loại `single-pool tier list`; đây là bằng chứng `AR-IW-94` và phải route sang archetype liền kề.
- Loại mọi candidate chỉ đạt task bằng cách đổi product noun hoặc treatment thị giác.

### Boundary verdict

Trả `accept` chỉ khi nhiệm vụ trội, đồ thị đầy đủ, hợp đồng chuyển đổi, state và recovery parity cùng acceptance focus đều đúng. Trả `reject` với mọi mã loại. Trả `needs-evidence` khi owner hoặc quan hệ chưa được giải quyết.

## Handoff

- **Grammar handoff:** Gắn owner, label, permission, nghĩa state trung thực và action được phép của sản phẩm vào các vùng đã khai báo.
- **Principles handoff:** Giải exact grid, measure, gap, alignment, sticky offset, bounded overflow và transition point do quan hệ quyết định.
- Không handoff nào được xóa vùng bắt buộc, thay nhiệm vụ trội hoặc làm yếu keyboard, focus, responsive hay recovery parity.

## Non-binding research evidence

### Evidence boundary

Research bên ngoài là bằng chứng tư vấn, không phải product truth. Nó hỗ trợ tổng hợp quan hệ task, responsive transformation, interaction và accessibility; nó không đặt tên owner StarCi, chọn exact geometry, tạo product fact hoặc cấp quyền copy giao diện nguồn.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [UNCITRAL — Legislative Guide on Insolvency Law](https://uncitral.un.org/en/texts/insolvency/legislativeguides/insolvency_law) | Proceeding, claim treatment, priority, and distribution concerns. | A jurisdiction-specific order or interface geometry. |
| [World Bank — Insolvency and creditor/debtor principles](https://www.worldbank.org/en/topic/financialsector/brief/the-world-bank-principles-for-effective-insolvency-and-creditor-rights) | International benchmark context for insolvency and secured-creditor regimes. | A court-approved fact or payment amount. |
| [Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Reviewable dense claim and pool records. | Legal priority or a copied component tree. |
| [W3C WAI — Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | Unobscured focus around persistent distribution receipts. | Legal truth or exact geometry. |

Bộ nguồn gồm tài liệu chính thức hiện hành từ ít nhất ba tổ chức độc lập và có bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "insolvency-priority-distribution-waterfall",
  "situationCodes": ["<matched AR-IW-* codes>"],
  "searchAliases": ["insolvency estate distribution","claim priority waterfall","encumbered pool allocation","pari passu claims"],
  "dominantTask": "Allocate one insolvency estate across encumbered asset pools and admitted claims in court-approved priority order, including within-class pro rata distributions, reserves, deficiencies, and objections.",
  "regions": ["insolvency-distribution","proceeding-estate-date-and-court-order-version","asset-pool-and-encumbrance-register","admitted-disputed-contingent-and-subordinated-claim-register","bipartite-claim-to-encumbered-pool-edges","available-estate-by-pool","pool-specific-priority-and-within-class-pro-rata","cross-pool-deficiency-surplus-and-reserve-ledger","objection-order-and-recalculation","approved-payment-schedule-and-closure-receipt"],
  "regionRelationships": ["insolvency-distribution → proceeding-estate-date-and-court-order-version → asset-pool-and-encumbrance-register ↔ admitted-disputed-contingent-and-subordinated-claim-register → bipartite-claim-to-encumbered-pool-edges → available-estate-by-pool → pool-specific-priority-and-within-class-pro-rata → cross-pool-deficiency-surplus-and-reserve-ledger → objection-order-and-recalculation → approved-payment-schedule-and-closure-receipt"],
  "responsive": {
    "wide": "<simultaneous required regions>",
    "intermediate": "<synchronized disclosures for displaced regions>",
    "compact": "<primary-pane trace sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "insolvency-distribution → proceeding-estate-date-and-court-order-version → asset-pool-and-encumbrance-register → admitted-disputed-contingent-and-subordinated-claim-register → bipartite-claim-to-encumbered-pool-edges → available-estate-by-pool → pool-specific-priority-and-within-class-pro-rata → cross-pool-deficiency-surplus-and-reserve-ledger → objection-order-and-recalculation → approved-payment-schedule-and-closure-receipt",
    "navigationReplacement": "<none | synchronized disclosure | primary-pane sequence>",
    "stickyBehavior": "<reserved-space outcome and short-height yield>",
    "overflowOwner": "admitted-disputed-contingent-and-subordinated-claim-register",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["estate estimated/realized","asset unencumbered/encumbered/disputed","claim filed/admitted/disputed/contingent/subordinated/rejected","class open/partially paid/satisfied/deficient","distribution provisional/approved/paid","reserve held/released","objection open/sustained/overruled","order current/amended/appealed","proceeding open/closed/reopened"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```
