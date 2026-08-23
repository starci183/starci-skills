# Customs Origin Valuation Duty Workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `customs-origin-valuation-duty-workbench` |
| Family | Work |
| Dominant task | Xác định cách xử lý hải quan của các mặt hàng trong lô hàng bằng cách đồng thời phân loại hàng hóa, xác lập trị giá hải quan, kiểm tra xuất xứ và dẫn xuất thuế quan, thuế cùng bằng chứng khai báo. |
| Search aliases | `customs classification valuation`, `origin qualification`, `duty derivation`, `entry amendment lineage` |
| Authority | Bản ghi này quy định topology vĩ mô dùng chung, trung lập với sản phẩm. |

### Invariants

- Nhiệm vụ trội không đổi: Xác định cách xử lý hải quan của các mặt hàng trong lô hàng bằng cách đồng thời phân loại hàng hóa, xác lập trị giá hải quan, kiểm tra xuất xứ và dẫn xuất thuế quan, thuế cùng bằng chứng khai báo.
- Đồ thị vùng bắt buộc không đổi: `customs-duty → shipment-entry-date-trade-agreement-and-law-version → item-evidence-register → classification-determination[goods-description → tariff-heading → measure] ↔ valuation-determination[method → transaction-value-adjustments → customs-value] ↔ origin-determination[bill-of-materials-and-production → origin-criterion → preference-status] → duty-tax-relief-and-additional-measure-calculation → declaration-document-evidence-and-exception → accepted-examined-amended-or-refunded-entry-lineage`.
- Phân loại, trị giá và xuất xứ vẫn là ba xác định ngang hàng với bằng chứng và bất định riêng; chúng chỉ hội tụ tại dẫn xuất thuế suất và thuế phải nộp.
- DOM order, reading order và meaningful focus order luôn giống nhau.
- Grammar sở hữu semantic sản phẩm; Principles sở hữu geometry chưa giải; Direction sở hữu visual character.
- Wide, intermediate và compact giữ action, state, keyboard access, overflow ownership và recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-CV-01` | Nhiệm vụ trội là kết quả chính của trang. | Bằng chứng ứng viên. |
| `AR-CV-02` | Mọi vùng bắt buộc và quan hệ được đặt tên đều hiện diện. | Bằng chứng bắt buộc. |
| `AR-CV-03` | Wide, intermediate và compact dùng đúng chuyển đổi topology đã khai báo. | Bằng chứng bắt buộc. |
| `AR-CV-04` | Compact giữ mọi action, state, đường bàn phím và recovery. | Bằng chứng bắt buộc. |
| `AR-CV-05` | Mẫu tương tác chứng minh acceptance focus của prompt. | Bằng chứng bắt buộc. |
| `AR-CV-90` | multi-program-eligibility-screening | Loại. |
| `AR-CV-91` | rule-builder-workbench | Loại. |
| `AR-CV-92` | calculation-estimate-flow | Loại. |
| `AR-CV-93` | evidence-led-case-resolution-dossier | Loại. |

### Selection rule

Chọn `customs-origin-valuation-duty-workbench` chỉ khi các mã 01–05 được chứng minh và không có mã 9*. Trả `needs-evidence` khi chưa rõ owner hoặc quan hệ; trả `reject` khi có bằng chứng loại; khác biệt chỉ ở noun, density, color, card count, component hoặc state là `duplicate-or-variation`.

## Region graph

```text
customs-duty
   `-- shipment-entry-date-trade-agreement-and-law-version
      `-- item-evidence-register
         `-- classification-determination
            `-- goods-description
               `-- tariff-heading
                  `-- measure
                     `-- valuation-determination
                        `-- method
                           `-- transaction-value-adjustments
                              `-- customs-value
                                 `-- origin-determination
                                    `-- bill-of-materials-and-production
                                       `-- origin-criterion
                                          `-- preference-status
                                             `-- duty-tax-relief-and-additional-measure-calculation
                                                `-- declaration-document-evidence-and-exception
                                                   `-- accepted-examined-amended-or-refunded-entry-lineage
```

Biểu thức quan hệ đã khai báo: `customs-duty → shipment-entry-date-trade-agreement-and-law-version → item-evidence-register → classification-determination[goods-description → tariff-heading → measure] ↔ valuation-determination[method → transaction-value-adjustments → customs-value] ↔ origin-determination[bill-of-materials-and-production → origin-criterion → preference-status] → duty-tax-relief-and-additional-measure-calculation → declaration-document-evidence-and-exception → accepted-examined-amended-or-refunded-entry-lineage`.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `customs-duty` | Sở hữu nhiệm vụ trội, context phiên bản và recovery của mọi hậu duệ. | Là gốc của đồ thị và không thể bị thay bằng container chung. |
| `shipment-entry-date-trade-agreement-and-law-version` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `item-evidence-register` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `classification-determination` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `goods-description` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `tariff-heading` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `measure` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `valuation-determination` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `method` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `transaction-value-adjustments` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `customs-value` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `origin-determination` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `bill-of-materials-and-production` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `origin-criterion` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `preference-status` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `duty-tax-relief-and-additional-measure-calculation` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `declaration-document-evidence-and-exception` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `accepted-examined-amended-or-refunded-entry-lineage` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ được nhãn đọc được, liên kết rõ, action thấy được và focus không bị che.
- **Topology response:** Shipment items, tariff reasoning, value adjustments, material and process origin test, duty calculation, and declaration evidence remain simultaneously visible.
- **Navigation replacement:** Không thay thế khi mọi owner bắt buộc còn dùng đồng thời.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được sticky; nó giữ chỗ và trở về in-flow khi chiều cao ngắn.
- **Overflow owner:** `item-evidence-register` Chỉ vùng đã khai báo sở hữu overflow có giới hạn; nội dung thường không tạo cuộn ngang toàn trang.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng persistent ưu tiên thấp nhất phá quan hệ trội.
- **Topology response:** The selected item and unresolved classification or origin issue remain primary; the full bill of materials, valuation history, and prior entries move to synchronized disclosures.
- **Navigation replacement:** Disclosure hoặc drawer đồng bộ có tên thay vùng bị dời và trigger nêu trạng thái hiện tại.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được sticky; nó giữ chỗ và trở về in-flow khi chiều cao ngắn.
- **Overflow owner:** `item-evidence-register` Chỉ vùng đã khai báo sở hữu overflow có giới hạn; nội dung thường không tạo cuộn ngang toàn trang.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai owner đồng thời không thể giữ bằng chứng đọc được và control 44×44 CSS px.
- **Topology response:** Entry and item → classify and measure → build customs value → test origin criterion → apply preference or general rate → calculate duty and tax → attach evidence → submit or amend becomes an item route.
- **Navigation replacement:** Một chuỗi primary-pane với Previous và Next giữ selection, query, state và scroll context.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được sticky; nó giữ chỗ và trở về in-flow khi chiều cao ngắn.
- **Overflow owner:** `item-evidence-register` Chỉ vùng đã khai báo sở hữu overflow có giới hạn; nội dung thường không tạo cuộn ngang toàn trang.

### Reflow

- Semantic order và DOM order là `customs-duty → shipment-entry-date-trade-agreement-and-law-version → item-evidence-register → classification-determination → goods-description → tariff-heading → measure → valuation-determination → method → transaction-value-adjustments → customs-value → origin-determination → bill-of-materials-and-production → origin-criterion → preference-status → duty-tax-relief-and-additional-measure-calculation → declaration-document-evidence-and-exception → accepted-examined-amended-or-refunded-entry-lineage`.
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
| Initial / loading | `shipment-entry-date-trade-agreement-and-law-version` | Xác định scope đang chờ và giữ semantic position. |
| Ready | `item-evidence-register` | Bộc lộ đầy đủ nhiệm vụ trội và phiên bản hiện tại. |
| Empty / not applicable | `classification-determination` | Phân biệt vắng mặt có ý nghĩa với bằng chứng không khả dụng. |
| Error / retry | `goods-description` | Giữ context hợp lệ và cho retry cục bộ không reset selection. |
| Permission / unavailable | `tariff-heading` | Không ngụ ý bằng chứng bị hạn chế là không tồn tại; cung cấp route an toàn. |
| Pending | `measure` | Ngăn action lặp và announce tiến độ mà không dời focus. |
| Success | `valuation-determination` | Bộc lộ outcome, provenance và action hợp lệ tiếp theo. |
| Stale / conflict | `method` | Giữ giá trị an toàn cuối và yêu cầu reconciliation rõ. |
| Focus transition | `transaction-value-adjustments` | Chỉ dời focus tới error summary bắt buộc; sau recovery trả đúng trigger. |
| Responsive presentation | `customs-value` | Giữ entity, query, state và recovery khi topology đổi. |
| entry draft/submitted/selected-for-exam | `shipment-entry-date-trade-agreement-and-law-version` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| item classified/ambiguous | `item-evidence-register` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| value method accepted/challenged | `classification-determination` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| adjustment included/excluded | `goods-description` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| material origin verified/missing | `tariff-heading` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| rule test pass/fail/indeterminate | `measure` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| preference claimed/denied | `valuation-determination` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| duty provisional/final/underpaid/refundable | `method` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| document valid/expired/missing | `transaction-value-adjustments` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| entry accepted/amended/refunded | `customs-value` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |

## Boundaries

### Accept

- Chỉ accept khi nhiệm vụ trội biến đổi bằng chứng bắt buộc thành outcome khai báo.
- Chỉ accept khi mỗi vùng có owner độc lập và quan hệ vẫn rõ.
- Ba xác định ngang hàng độc lập cho phân loại thuế quan, trị giá hải quan và xuất xứ giữ bằng chứng cùng bất định riêng, và chỉ hội tụ tại dẫn xuất thuế suất, bằng chứng khai báo và lineage tờ khai.

### Reject

- Loại `multi-program-eligibility-screening`; đây là bằng chứng `AR-CV-90` và phải route sang archetype liền kề.
- Loại `rule-builder-workbench`; đây là bằng chứng `AR-CV-91` và phải route sang archetype liền kề.
- Loại `calculation-estimate-flow`; đây là bằng chứng `AR-CV-92` và phải route sang archetype liền kề.
- Loại `evidence-led-case-resolution-dossier`; đây là bằng chứng `AR-CV-93` và phải route sang archetype liền kề.
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
| [World Customs Organization — Rules of Origin Compendium](https://www.wcoomd.org/en/topics/origin/overview/origin-compendium.aspx?p=1) | Preferential and non-preferential origin reasoning and evidence concerns. | A shipment's origin result or interface geometry. |
| [World Trade Organization — Customs valuation](https://www.wto.org/english/tratop_e/cusval_e/cusval_e.htm) | Fair, uniform, neutral valuation and the valuation agreement context. | A tariff classification, origin result, or declared value. |
| [Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Dense item evidence and comparison behavior. | Customs law or copied component structure. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Meaningful keyboard traversal across peer determinations. | Customs truth or exact responsive geometry. |

Bộ nguồn gồm tài liệu chính thức hiện hành từ ít nhất ba tổ chức độc lập và có bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "customs-origin-valuation-duty-workbench",
  "situationCodes": ["<matched AR-CV-* codes>"],
  "searchAliases": ["customs classification valuation","origin qualification","duty derivation","entry amendment lineage"],
  "dominantTask": "Determine customs treatment of shipment items by jointly classifying goods, establishing customs value, testing origin, and deriving duties, taxes, and declaration evidence.",
  "regions": ["customs-duty","shipment-entry-date-trade-agreement-and-law-version","item-evidence-register","classification-determination","goods-description","tariff-heading","measure","valuation-determination","method","transaction-value-adjustments","customs-value","origin-determination","bill-of-materials-and-production","origin-criterion","preference-status","duty-tax-relief-and-additional-measure-calculation","declaration-document-evidence-and-exception","accepted-examined-amended-or-refunded-entry-lineage"],
  "regionRelationships": ["customs-duty → shipment-entry-date-trade-agreement-and-law-version → item-evidence-register → classification-determination[goods-description → tariff-heading → measure] ↔ valuation-determination[method → transaction-value-adjustments → customs-value] ↔ origin-determination[bill-of-materials-and-production → origin-criterion → preference-status] → duty-tax-relief-and-additional-measure-calculation → declaration-document-evidence-and-exception → accepted-examined-amended-or-refunded-entry-lineage"],
  "responsive": {
    "wide": "<simultaneous required regions>",
    "intermediate": "<synchronized disclosures for displaced regions>",
    "compact": "<primary-pane trace sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "customs-duty → shipment-entry-date-trade-agreement-and-law-version → item-evidence-register → classification-determination → goods-description → tariff-heading → measure → valuation-determination → method → transaction-value-adjustments → customs-value → origin-determination → bill-of-materials-and-production → origin-criterion → preference-status → duty-tax-relief-and-additional-measure-calculation → declaration-document-evidence-and-exception → accepted-examined-amended-or-refunded-entry-lineage",
    "navigationReplacement": "<none | synchronized disclosure | primary-pane sequence>",
    "stickyBehavior": "<reserved-space outcome and short-height yield>",
    "overflowOwner": "item-evidence-register",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["entry draft/submitted/selected-for-exam","item classified/ambiguous","value method accepted/challenged","adjustment included/excluded","material origin verified/missing","rule test pass/fail/indeterminate","preference claimed/denied","duty provisional/final/underpaid/refundable","document valid/expired/missing","entry accepted/amended/refunded"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

