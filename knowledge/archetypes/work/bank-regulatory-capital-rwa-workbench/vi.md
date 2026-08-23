# Bank Regulatory Capital RWA Workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `bank-regulatory-capital-rwa-workbench` |
| Family | Work |
| Dominant task | Dẫn xuất tài sản có trọng số rủi ro và các tỷ lệ vốn pháp định của ngân hàng cho một phạm vi báo cáo và phiên bản khuôn khổ, đồng thời truy vết mọi cách xử lý khoản phơi nhiễm và điều chỉnh vốn tới các ô công bố đã nộp. |
| Search aliases | `regulatory capital trace`, `RWA derivation`, `capital ratio filing`, `Pillar 3 mapping` |
| Authority | Bản ghi này quy định topology vĩ mô dùng chung, trung lập với sản phẩm. |

### Invariants

- Nhiệm vụ trội không đổi: Dẫn xuất tài sản có trọng số rủi ro và các tỷ lệ vốn pháp định của ngân hàng cho một phạm vi báo cáo và phiên bản khuôn khổ, đồng thời truy vết mọi cách xử lý khoản phơi nhiễm và điều chỉnh vốn tới các ô công bố đã nộp.
- Đồ thị vùng bắt buộc không đổi: `capital-rwa → reporting-scope-date-framework-and-approach-version → numerator-graph[capital-instruments → eligibility → regulatory-deductions → tier-capital-totals] ↔ denominator-graph[exposure-register → exposure-class-ccf-collateral-guarantee-and-risk-parameter-derivation → credit-market-operational-and-cva-rwa → output-floor-and-scaling] → ratio-buffer-and-shortfall-receipt → regulatory-template-mapping → review-submit-and-restatement-lineage`.
- Đồ thị đủ điều kiện và khấu trừ của tử số vẫn được kiểm tra độc lập với đồ thị mẫu số từ khoản phơi nhiễm đến RWA; hai đồ thị chỉ gặp nhau tại từng tỷ lệ.
- DOM order, reading order và meaningful focus order luôn giống nhau.
- Grammar sở hữu semantic sản phẩm; Principles sở hữu geometry chưa giải; Direction sở hữu visual character.
- Wide, intermediate và compact giữ action, state, keyboard access, overflow ownership và recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-CR-01` | Nhiệm vụ trội là kết quả chính của trang. | Bằng chứng ứng viên. |
| `AR-CR-02` | Mọi vùng bắt buộc và quan hệ được đặt tên đều hiện diện. | Bằng chứng bắt buộc. |
| `AR-CR-03` | Wide, intermediate và compact dùng đúng chuyển đổi topology đã khai báo. | Bằng chứng bắt buộc. |
| `AR-CR-04` | Compact giữ mọi action, state, đường bàn phím và recovery. | Bằng chứng bắt buộc. |
| `AR-CR-05` | Mẫu tương tác chứng minh acceptance focus của prompt. | Bằng chứng bắt buộc. |
| `AR-CR-90` | capacity-allocation-overview | Loại. |
| `AR-CR-91` | portfolio-health-matrix | Loại. |
| `AR-CR-92` | scenario-sensitivity-modeler | Loại. |
| `AR-CR-93` | bridge-contribution-waterfall-overview | Loại. |

### Selection rule

Chọn `bank-regulatory-capital-rwa-workbench` chỉ khi các mã 01–05 được chứng minh và không có mã 9*. Trả `needs-evidence` khi chưa rõ owner hoặc quan hệ; trả `reject` khi có bằng chứng loại; khác biệt chỉ ở noun, density, color, card count, component hoặc state là `duplicate-or-variation`.

## Region graph

```text
capital-rwa
   `-- reporting-scope-date-framework-and-approach-version
      `-- numerator-graph
         `-- capital-instruments
            `-- eligibility
               `-- regulatory-deductions
                  `-- tier-capital-totals
                     `-- denominator-graph
                        `-- exposure-register
                           `-- exposure-class-ccf-collateral-guarantee-and-risk-parameter-derivation
                              `-- credit-market-operational-and-cva-rwa
                                 `-- output-floor-and-scaling
                                    `-- ratio-buffer-and-shortfall-receipt
                                       `-- regulatory-template-mapping
                                          `-- review-submit-and-restatement-lineage
```

Biểu thức quan hệ đã khai báo: `capital-rwa → reporting-scope-date-framework-and-approach-version → numerator-graph[capital-instruments → eligibility → regulatory-deductions → tier-capital-totals] ↔ denominator-graph[exposure-register → exposure-class-ccf-collateral-guarantee-and-risk-parameter-derivation → credit-market-operational-and-cva-rwa → output-floor-and-scaling] → ratio-buffer-and-shortfall-receipt → regulatory-template-mapping → review-submit-and-restatement-lineage`.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `capital-rwa` | Sở hữu nhiệm vụ trội, context phiên bản và recovery của mọi hậu duệ. | Là gốc của đồ thị và không thể bị thay bằng container chung. |
| `reporting-scope-date-framework-and-approach-version` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `numerator-graph` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `capital-instruments` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `eligibility` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `regulatory-deductions` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `tier-capital-totals` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `denominator-graph` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `exposure-register` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `exposure-class-ccf-collateral-guarantee-and-risk-parameter-derivation` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `credit-market-operational-and-cva-rwa` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `output-floor-and-scaling` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `ratio-buffer-and-shortfall-receipt` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `regulatory-template-mapping` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `review-submit-and-restatement-lineage` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ được nhãn đọc được, liên kết rõ, action thấy được và focus không bị che.
- **Topology response:** Capital components, exposure derivations, RWA rollups, ratios, buffers, and filing mappings remain simultaneously visible.
- **Navigation replacement:** Không thay thế khi mọi owner bắt buộc còn dùng đồng thời.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được sticky; nó giữ chỗ và trở về in-flow khi chiều cao ngắn.
- **Overflow owner:** `exposure-register` Chỉ vùng đã khai báo sở hữu overflow có giới hạn; nội dung thường không tạo cuộn ngang toàn trang.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng persistent ưu tiên thấp nhất phá quan hệ trội.
- **Topology response:** Ratio shortfalls and the selected exposure trace remain primary; the full register, framework evidence, and filing history move to synchronized disclosures.
- **Navigation replacement:** Disclosure hoặc drawer đồng bộ có tên thay vùng bị dời và trigger nêu trạng thái hiện tại.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được sticky; nó giữ chỗ và trở về in-flow khi chiều cao ngắn.
- **Overflow owner:** `exposure-register` Chỉ vùng đã khai báo sở hữu overflow có giới hạn; nội dung thường không tạo cuộn ngang toàn trang.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai owner đồng thời không thể giữ bằng chứng đọc được và control 44×44 CSS px.
- **Topology response:** Reporting scope → ratio or buffer → numerator and RWA denominator → risk-type rollup → exposure treatment → filing cell → approval or restatement becomes one trace route.
- **Navigation replacement:** Một chuỗi primary-pane với Previous và Next giữ selection, query, state và scroll context.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được sticky; nó giữ chỗ và trở về in-flow khi chiều cao ngắn.
- **Overflow owner:** `exposure-register` Chỉ vùng đã khai báo sở hữu overflow có giới hạn; nội dung thường không tạo cuộn ngang toàn trang.

### Reflow

- Semantic order và DOM order là `capital-rwa → reporting-scope-date-framework-and-approach-version → numerator-graph → capital-instruments → eligibility → regulatory-deductions → tier-capital-totals → denominator-graph → exposure-register → exposure-class-ccf-collateral-guarantee-and-risk-parameter-derivation → credit-market-operational-and-cva-rwa → output-floor-and-scaling → ratio-buffer-and-shortfall-receipt → regulatory-template-mapping → review-submit-and-restatement-lineage`.
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
| Initial / loading | `reporting-scope-date-framework-and-approach-version` | Xác định scope đang chờ và giữ semantic position. |
| Ready | `numerator-graph` | Bộc lộ đầy đủ nhiệm vụ trội và phiên bản hiện tại. |
| Empty / not applicable | `capital-instruments` | Phân biệt vắng mặt có ý nghĩa với bằng chứng không khả dụng. |
| Error / retry | `eligibility` | Giữ context hợp lệ và cho retry cục bộ không reset selection. |
| Permission / unavailable | `regulatory-deductions` | Không ngụ ý bằng chứng bị hạn chế là không tồn tại; cung cấp route an toàn. |
| Pending | `tier-capital-totals` | Ngăn action lặp và announce tiến độ mà không dời focus. |
| Success | `denominator-graph` | Bộc lộ outcome, provenance và action hợp lệ tiếp theo. |
| Stale / conflict | `exposure-register` | Giữ giá trị an toàn cuối và yêu cầu reconciliation rõ. |
| Focus transition | `exposure-class-ccf-collateral-guarantee-and-risk-parameter-derivation` | Chỉ dời focus tới error summary bắt buộc; sau recovery trả đúng trigger. |
| Responsive presentation | `credit-market-operational-and-cva-rwa` | Giữ entity, query, state và recovery khi topology đổi. |
| framework current/future/superseded | `reporting-scope-date-framework-and-approach-version` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| scope complete/incomplete | `numerator-graph` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| exposure classified/unclassified | `capital-instruments` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| approach permitted/not-approved | `eligibility` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| mitigation eligible/ineligible | `regulatory-deductions` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| parameter missing/overridden | `tier-capital-totals` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| RWA calculated/failed | `denominator-graph` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| output floor inactive/binding | `exposure-register` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| capital eligible/deducted | `exposure-class-ccf-collateral-guarantee-and-risk-parameter-derivation` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| ratio compliant/near/short | `credit-market-operational-and-cva-rwa` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| filing draft/submitted/rejected | `output-floor-and-scaling` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| restatement pending/complete | `ratio-buffer-and-shortfall-receipt` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |

## Boundaries

### Accept

- Chỉ accept khi nhiệm vụ trội biến đổi bằng chứng bắt buộc thành outcome khai báo.
- Chỉ accept khi mỗi vùng có owner độc lập và quan hệ vẫn rõ.
- Có hai đồ thị dẫn xuất tử số và mẫu số có thể kiểm tra độc lập, phiên bản khuôn khổ và phương pháp, cách xử lý khoản phơi nhiễm, giảm thiểu, RWA theo loại rủi ro, đủ điều kiện và khấu trừ vốn, tỷ lệ, bộ đệm và lineage ô khai báo.

### Reject

- Loại `capacity-allocation-overview`; đây là bằng chứng `AR-CR-90` và phải route sang archetype liền kề.
- Loại `portfolio-health-matrix`; đây là bằng chứng `AR-CR-91` và phải route sang archetype liền kề.
- Loại `scenario-sensitivity-modeler`; đây là bằng chứng `AR-CR-92` và phải route sang archetype liền kề.
- Loại `bridge-contribution-waterfall-overview`; đây là bằng chứng `AR-CR-93` và phải route sang archetype liền kề.
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
| [Basel Committee — RBC20](https://www.bis.org/basel_framework/chapter/RBC/20.htm) | Capital components and minimum ratio relationships. | A product layout, local approach permission, or filing value. |
| [European Banking Authority — Pillar 3 templates](https://eba.europa.eu/activities/single-rulebook/regulatory-activities/transparency-and-pillar-3/overview-pillar-3-templates-and-it-solutions) | Structured disclosure templates and reporting lineage. | A bank's calculated value or UI geometry. |
| [Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Dense records, selection, and status-bearing table behavior. | Regulatory semantics or a copied component tree. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Meaningful keyboard focus order through a derivation trace. | Financial truth or exact responsive geometry. |

Bộ nguồn gồm tài liệu chính thức hiện hành từ ít nhất ba tổ chức độc lập và có bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "bank-regulatory-capital-rwa-workbench",
  "situationCodes": ["<matched AR-CR-* codes>"],
  "searchAliases": ["regulatory capital trace","RWA derivation","capital ratio filing","Pillar 3 mapping"],
  "dominantTask": "Derive a bank's risk-weighted assets and regulatory capital ratios for one reporting scope and framework version, tracing every exposure treatment and capital adjustment into submitted disclosure cells.",
  "regions": ["capital-rwa","reporting-scope-date-framework-and-approach-version","numerator-graph","capital-instruments","eligibility","regulatory-deductions","tier-capital-totals","denominator-graph","exposure-register","exposure-class-ccf-collateral-guarantee-and-risk-parameter-derivation","credit-market-operational-and-cva-rwa","output-floor-and-scaling","ratio-buffer-and-shortfall-receipt","regulatory-template-mapping","review-submit-and-restatement-lineage"],
  "regionRelationships": ["capital-rwa → reporting-scope-date-framework-and-approach-version → numerator-graph[capital-instruments → eligibility → regulatory-deductions → tier-capital-totals] ↔ denominator-graph[exposure-register → exposure-class-ccf-collateral-guarantee-and-risk-parameter-derivation → credit-market-operational-and-cva-rwa → output-floor-and-scaling] → ratio-buffer-and-shortfall-receipt → regulatory-template-mapping → review-submit-and-restatement-lineage"],
  "responsive": {
    "wide": "<simultaneous required regions>",
    "intermediate": "<synchronized disclosures for displaced regions>",
    "compact": "<primary-pane trace sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "capital-rwa → reporting-scope-date-framework-and-approach-version → numerator-graph → capital-instruments → eligibility → regulatory-deductions → tier-capital-totals → denominator-graph → exposure-register → exposure-class-ccf-collateral-guarantee-and-risk-parameter-derivation → credit-market-operational-and-cva-rwa → output-floor-and-scaling → ratio-buffer-and-shortfall-receipt → regulatory-template-mapping → review-submit-and-restatement-lineage",
    "navigationReplacement": "<none | synchronized disclosure | primary-pane sequence>",
    "stickyBehavior": "<reserved-space outcome and short-height yield>",
    "overflowOwner": "exposure-register",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["framework current/future/superseded","scope complete/incomplete","exposure classified/unclassified","approach permitted/not-approved","mitigation eligible/ineligible","parameter missing/overridden","RWA calculated/failed","output floor inactive/binding","capital eligible/deducted","ratio compliant/near/short","filing draft/submitted/rejected","restatement pending/complete"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

