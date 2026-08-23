# Exchange Volatility Auction Reopening Console

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `exchange-volatility-auction-reopening-console` |
| Family | Work |
| Dominant task | Điều khiển một công cụ từ lúc tạm dừng giao dịch do biến động qua phiên đấu giá mở lại minh bạch, dẫn xuất giá chỉ báo và mất cân bằng, áp dụng quy tắc gia hạn, khớp chéo một lần rồi trở lại đúng trạng thái giao dịch. |
| Search aliases | `volatility reopening auction`, `LULD pause console`, `indicative match imbalance`, `auction uncross receipt` |
| Authority | Bản ghi này quy định topology vĩ mô dùng chung, trung lập với sản phẩm. |

### Invariants

- Nhiệm vụ trội không đổi: Điều khiển một công cụ từ lúc tạm dừng giao dịch do biến động qua phiên đấu giá mở lại minh bạch, dẫn xuất giá chỉ báo và mất cân bằng, áp dụng quy tắc gia hạn, khớp chéo một lần rồi trở lại đúng trạng thái giao dịch.
- Đồ thị vùng bắt buộc không đổi: `volatility-reopening → venue-instrument-session-rule-and-clock-version → reference-price-and-dynamic-price-bands → triggering-trade-or-quote-and-halt-reason → auction-order-book[price-time-side-quantity] ↔ indicative-match-price-executable-volume-and-imbalance → order-entry-cancel-freeze-and-extension-gates → uncross-allocation-and-residual-book → reopening-trade-and-price-band-reset → continuous-trading-state-and-surveillance-receipt`.
- Các lệnh đấu giá cùng sở hữu một trạng thái khớp chỉ báo; mở lại phải chờ các gate về đồng hồ, khoảng giá, mất cân bằng và gia hạn trước một lần uncross xác định.
- DOM order, reading order và meaningful focus order luôn giống nhau.
- Grammar sở hữu semantic sản phẩm; Principles sở hữu geometry chưa giải; Direction sở hữu visual character.
- Wide, intermediate và compact giữ action, state, keyboard access, overflow ownership và recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-VA-01` | Nhiệm vụ trội là kết quả chính của trang. | Bằng chứng ứng viên. |
| `AR-VA-02` | Mọi vùng bắt buộc và quan hệ được đặt tên đều hiện diện. | Bằng chứng bắt buộc. |
| `AR-VA-03` | Wide, intermediate và compact dùng đúng chuyển đổi topology đã khai báo. | Bằng chứng bắt buộc. |
| `AR-VA-04` | Compact giữ mọi action, state, đường bàn phím và recovery. | Bằng chứng bắt buộc. |
| `AR-VA-05` | Mẫu tương tác chứng minh acceptance focus của prompt. | Bằng chứng bắt buộc. |
| `AR-VA-90` | live-operations-control-room | Loại. |
| `AR-VA-91` | timeline-status-monitor | Loại. |
| `AR-VA-92` | inventory-replenishment-planner | Loại. |
| `AR-VA-93` | generic market dashboard | Loại. |

### Selection rule

Chọn `exchange-volatility-auction-reopening-console` chỉ khi các mã 01–05 được chứng minh và không có mã 9*. Trả `needs-evidence` khi chưa rõ owner hoặc quan hệ; trả `reject` khi có bằng chứng loại; khác biệt chỉ ở noun, density, color, card count, component hoặc state là `duplicate-or-variation`.

## Region graph

```text
volatility-reopening
   `-- venue-instrument-session-rule-and-clock-version
      `-- reference-price-and-dynamic-price-bands
         `-- triggering-trade-or-quote-and-halt-reason
            `-- auction-order-book
               `-- price-time-side-quantity
                  `-- indicative-match-price-executable-volume-and-imbalance
                     `-- order-entry-cancel-freeze-and-extension-gates
                        `-- uncross-allocation-and-residual-book
                           `-- reopening-trade-and-price-band-reset
                              `-- continuous-trading-state-and-surveillance-receipt
```

Biểu thức quan hệ đã khai báo: `volatility-reopening → venue-instrument-session-rule-and-clock-version → reference-price-and-dynamic-price-bands → triggering-trade-or-quote-and-halt-reason → auction-order-book[price-time-side-quantity] ↔ indicative-match-price-executable-volume-and-imbalance → order-entry-cancel-freeze-and-extension-gates → uncross-allocation-and-residual-book → reopening-trade-and-price-band-reset → continuous-trading-state-and-surveillance-receipt`.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `volatility-reopening` | Sở hữu nhiệm vụ trội, context phiên bản và recovery của mọi hậu duệ. | Là gốc của đồ thị và không thể bị thay bằng container chung. |
| `venue-instrument-session-rule-and-clock-version` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `reference-price-and-dynamic-price-bands` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `triggering-trade-or-quote-and-halt-reason` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `auction-order-book` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `price-time-side-quantity` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `indicative-match-price-executable-volume-and-imbalance` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `order-entry-cancel-freeze-and-extension-gates` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `uncross-allocation-and-residual-book` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `reopening-trade-and-price-band-reset` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |
| `continuous-trading-state-and-surveillance-receipt` | Sở hữu bằng chứng, action, state và recovery của vùng này. | Theo semantic order và tiêu thụ đúng context đã chọn; các cạnh peer vẫn đồng bộ mà không hợp nhất owner. |

## Responsive contract

### Wide

- **Failure trigger:** Wide kết thúc khi các vùng đồng thời không còn giữ được nhãn đọc được, liên kết rõ, action thấy được và focus không bị che.
- **Topology response:** Trading-state clock, reference and bands, depth book, indicative clearing state, extension gates, and reopening receipt remain simultaneously visible.
- **Navigation replacement:** Không thay thế khi mọi owner bắt buộc còn dùng đồng thời.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được sticky; nó giữ chỗ và trở về in-flow khi chiều cao ngắn.
- **Overflow owner:** `auction-order-book` Chỉ vùng đã khai báo sở hữu overflow có giới hạn; nội dung thường không tạo cuộn ngang toàn trang.

### Intermediate

- **Failure trigger:** Intermediate bắt đầu khi vùng persistent ưu tiên thấp nhất phá quan hệ trội.
- **Topology response:** Indicative clearing state and the blocking gate remain primary; full depth, trigger evidence, and surveillance history move to synchronized disclosures while the price ladder owns bounded overflow.
- **Navigation replacement:** Disclosure hoặc drawer đồng bộ có tên thay vùng bị dời và trigger nêu trạng thái hiện tại.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được sticky; nó giữ chỗ và trở về in-flow khi chiều cao ngắn.
- **Overflow owner:** `auction-order-book` Chỉ vùng đã khai báo sở hữu overflow có giới hạn; nội dung thường không tạo cuộn ngang toàn trang.

### Compact

- **Failure trigger:** Compact bắt đầu khi hai owner đồng thời không thể giữ bằng chứng đọc được và control 44×44 CSS px.
- **Topology response:** Halt reason and clock → reference and bands → price-level navigator → indicative clearing state → enter or cancel → extension → one uncross → residual and reopen receipt becomes a controlled sequence.
- **Navigation replacement:** Một chuỗi primary-pane với Previous và Next giữ selection, query, state và scroll context.
- **Sticky boundary:** Chỉ outcome hoặc action hiện tại được sticky; nó giữ chỗ và trở về in-flow khi chiều cao ngắn.
- **Overflow owner:** `auction-order-book` Chỉ vùng đã khai báo sở hữu overflow có giới hạn; nội dung thường không tạo cuộn ngang toàn trang.

### Reflow

- Semantic order và DOM order là `volatility-reopening → venue-instrument-session-rule-and-clock-version → reference-price-and-dynamic-price-bands → triggering-trade-or-quote-and-halt-reason → auction-order-book → price-time-side-quantity → indicative-match-price-executable-volume-and-imbalance → order-entry-cancel-freeze-and-extension-gates → uncross-allocation-and-residual-book → reopening-trade-and-price-band-reset → continuous-trading-state-and-surveillance-receipt`.
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
| Initial / loading | `venue-instrument-session-rule-and-clock-version` | Xác định scope đang chờ và giữ semantic position. |
| Ready | `reference-price-and-dynamic-price-bands` | Bộc lộ đầy đủ nhiệm vụ trội và phiên bản hiện tại. |
| Empty / not applicable | `triggering-trade-or-quote-and-halt-reason` | Phân biệt vắng mặt có ý nghĩa với bằng chứng không khả dụng. |
| Error / retry | `auction-order-book` | Giữ context hợp lệ và cho retry cục bộ không reset selection. |
| Permission / unavailable | `price-time-side-quantity` | Không ngụ ý bằng chứng bị hạn chế là không tồn tại; cung cấp route an toàn. |
| Pending | `indicative-match-price-executable-volume-and-imbalance` | Ngăn action lặp và announce tiến độ mà không dời focus. |
| Success | `order-entry-cancel-freeze-and-extension-gates` | Bộc lộ outcome, provenance và action hợp lệ tiếp theo. |
| Stale / conflict | `uncross-allocation-and-residual-book` | Giữ giá trị an toàn cuối và yêu cầu reconciliation rõ. |
| Focus transition | `reopening-trade-and-price-band-reset` | Chỉ dời focus tới error summary bắt buộc; sau recovery trả đúng trigger. |
| Responsive presentation | `continuous-trading-state-and-surveillance-receipt` | Giữ entity, query, state và recovery khi topology đổi. |
| session preopen/continuous/halted/auction/reopened/closed | `venue-instrument-session-rule-and-clock-version` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| band current/reset/stale | `reference-price-and-dynamic-price-bands` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| trigger valid/cancelled | `triggering-trade-or-quote-and-halt-reason` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| order accepted/rejected/cancelled/frozen | `auction-order-book` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| indicative price available/unavailable/outside-range | `price-time-side-quantity` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| imbalance buy/sell/balanced | `indicative-match-price-executable-volume-and-imbalance` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| extension inactive/triggered/repeated/exhausted | `order-entry-cancel-freeze-and-extension-gates` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| uncross blocked/ready/executing/complete/failed | `uncross-allocation-and-residual-book` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| allocation full/partial | `reopening-trade-and-price-band-reset` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| residual resting/cancelled | `continuous-trading-state-and-surveillance-receipt` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |
| surveillance clear/flagged | `continuous-trading-state-and-surveillance-receipt` | Bộc lộ cause, consequence và recovery hợp lệ mà không ghi đè provenance. |

## Boundaries

### Accept

- Chỉ accept khi nhiệm vụ trội biến đổi bằng chứng bắt buộc thành outcome khai báo.
- Chỉ accept khi mỗi vùng có owner độc lập và quan hệ vẫn rõ.
- Có máy trạng thái riêng cho công cụ, biên giá động, sổ đấu giá theo giá-thời gian, giá khớp chỉ báo và mất cân bằng được dẫn xuất chung, gia hạn theo thời gian, một lần uncross xác định, sổ dư và chuyển đổi rõ về giao dịch liên tục.

### Reject

- Loại `live-operations-control-room`; đây là bằng chứng `AR-VA-90` và phải route sang archetype liền kề.
- Loại `timeline-status-monitor`; đây là bằng chứng `AR-VA-91` và phải route sang archetype liền kề.
- Loại `inventory-replenishment-planner`; đây là bằng chứng `AR-VA-92` và phải route sang archetype liền kề.
- Loại `generic market dashboard`; đây là bằng chứng `AR-VA-93` và phải route sang archetype liền kề.
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
| [Limit Up-Limit Down Plan](https://www.luldplan.com/) | Reference-price bands, limit states, pauses, and time-based extensions. | A venue's exact auction algorithm or copied interface. |
| [NYSE — Trading information](https://beta.nyse.com/trade/trading-information) | Venue trading-state, auction, order, and operational-rule context. | A universal allocation rule or product geometry. |
| [Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Dense order-book records and explicit row states. | Exchange semantics or copied layout. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Announcement of indicative, gate, and reopen changes without focus theft. | Market truth or exact topology. |

Bộ nguồn gồm tài liệu chính thức hiện hành từ ít nhất ba tổ chức độc lập và có bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "exchange-volatility-auction-reopening-console",
  "situationCodes": ["<matched AR-VA-* codes>"],
  "searchAliases": ["volatility reopening auction","LULD pause console","indicative match imbalance","auction uncross receipt"],
  "dominantTask": "Control one instrument from a volatility-triggered trading pause through a transparent reopening auction, deriving indicative price and imbalance, applying extension rules, uncrossing once, and returning to the correct trading state.",
  "regions": ["volatility-reopening","venue-instrument-session-rule-and-clock-version","reference-price-and-dynamic-price-bands","triggering-trade-or-quote-and-halt-reason","auction-order-book","price-time-side-quantity","indicative-match-price-executable-volume-and-imbalance","order-entry-cancel-freeze-and-extension-gates","uncross-allocation-and-residual-book","reopening-trade-and-price-band-reset","continuous-trading-state-and-surveillance-receipt"],
  "regionRelationships": ["volatility-reopening → venue-instrument-session-rule-and-clock-version → reference-price-and-dynamic-price-bands → triggering-trade-or-quote-and-halt-reason → auction-order-book[price-time-side-quantity] ↔ indicative-match-price-executable-volume-and-imbalance → order-entry-cancel-freeze-and-extension-gates → uncross-allocation-and-residual-book → reopening-trade-and-price-band-reset → continuous-trading-state-and-surveillance-receipt"],
  "responsive": {
    "wide": "<simultaneous required regions>",
    "intermediate": "<synchronized disclosures for displaced regions>",
    "compact": "<primary-pane trace sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "volatility-reopening → venue-instrument-session-rule-and-clock-version → reference-price-and-dynamic-price-bands → triggering-trade-or-quote-and-halt-reason → auction-order-book → price-time-side-quantity → indicative-match-price-executable-volume-and-imbalance → order-entry-cancel-freeze-and-extension-gates → uncross-allocation-and-residual-book → reopening-trade-and-price-band-reset → continuous-trading-state-and-surveillance-receipt",
    "navigationReplacement": "<none | synchronized disclosure | primary-pane sequence>",
    "stickyBehavior": "<reserved-space outcome and short-height yield>",
    "overflowOwner": "auction-order-book",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["session preopen/continuous/halted/auction/reopened/closed","band current/reset/stale","trigger valid/cancelled","order accepted/rejected/cancelled/frozen","indicative price available/unavailable/outside-range","imbalance buy/sell/balanced","extension inactive/triggered/repeated/exhausted","uncross blocked/ready/executing/complete/failed","allocation full/partial","residual resting/cancelled","surveillance clear/flagged"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

