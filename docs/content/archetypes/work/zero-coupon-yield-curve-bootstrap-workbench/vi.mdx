# Bàn làm việc bootstrap đường cong zero-coupon

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `zero-coupon-yield-curve-bootstrap-workbench` |
| Family | Work |
| Dominant task | Dựng một zero-coupon curve theo ngày bằng cách giải market instruments theo dependency maturity, rồi chứng minh discount factors reprice toàn bộ input trong tolerance đã khai báo. |
| Search aliases | `curve bootstrap`, `discount-factor solver`, `maturity-node curve`, `instrument repricing` |
| Authority | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Dominant task giữ nguyên: Dựng một zero-coupon curve theo ngày bằng cách giải market instruments theo dependency maturity, rồi chứng minh discount factors reprice toàn bộ input trong tolerance đã khai báo.
- Region graph giữ nguyên toàn bộ stable English region IDs được khai báo bên dưới.
- Quan hệ bắt buộc: Every solved maturity node extends the known curve segment and owns discounting for later cash flows; publication requires repricing and arbitrage diagnostics to pass.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu exact geometry chưa resolve; Direction sở hữu visual character.
- Mọi state family phải giữ task, selection, action và recovery.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-YC-01` | Dominant task khớp chính xác Identity. | Bằng chứng ứng viên. |
| `AR-YC-02` | Toàn bộ required region graph cùng hiện diện. | Bằng chứng bắt buộc. |
| `AR-YC-03` | Compact giữ action, state, recovery và association của wide. | Bằng chứng bắt buộc. |
| `AR-YC-04` | Every solved maturity node extends the known curve segment and owns discounting for later cash flows; publication requires repricing and arbitrage diagnostics to pass. | Giữ như bất biến. |
| `AR-YC-90` | Dominant task thuộc ranh giới loại trừ:  scenario-sensitivity-modeler. | Từ chối. |
| `AR-YC-91` | Dominant task thuộc ranh giới loại trừ:  calculation-estimate-flow. | Từ chối. |
| `AR-YC-92` | Dominant task thuộc ranh giới loại trừ:  chart-specification-authoring-studio. | Từ chối. |
| `AR-YC-93` | Dominant task thuộc ranh giới loại trừ:  generic rate dashboard. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `zero-coupon-yield-curve-bootstrap-workbench` khi `AR-YC-01`, `AR-YC-02` và `AR-YC-03` có bằng chứng, đồng thời không mã rejection nào đúng. Trả `needs-evidence` khi thiếu owner hoặc relationship bắt buộc; trả `reject` khi có rejection evidence; khác biệt chỉ ở noun, count, density, color, component hoặc state là `duplicate-or-variation`.

## Sơ đồ vùng

```text
curve-bootstrap
└─ valuation-date-currency-collateral-and-convention-set
   └─ market-instrument-ladder
      └─ instrument-cashflow-expansion
         └─ dependency-ordered-maturity-nodes
            ├─ selected-node-equation-and-known-discount-factors
            └─ solver-and-interpolation-policy
               └─ zero-discount-forward-curve
                  └─ repricing-residual-and-arbitrage-diagnostics
                     └─ approved-curve-version
```

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `curve-bootstrap` | Sở hữu evidence, action và state của `curve-bootstrap` mà không vay product semantics. | Là gốc của graph. |
| `valuation-date-currency-collateral-and-convention-set` | Sở hữu evidence, action và state của `valuation-date-currency-collateral-and-convention-set` mà không vay product semantics. | Theo semantic order của graph và giữ association với `curve-bootstrap`. |
| `market-instrument-ladder` | Sở hữu evidence, action và state của `market-instrument-ladder` mà không vay product semantics. | Theo semantic order của graph và giữ association với `valuation-date-currency-collateral-and-convention-set`. |
| `instrument-cashflow-expansion` | Sở hữu evidence, action và state của `instrument-cashflow-expansion` mà không vay product semantics. | Theo semantic order của graph và giữ association với `market-instrument-ladder`. |
| `dependency-ordered-maturity-nodes` | Sở hữu evidence, action và state của `dependency-ordered-maturity-nodes` mà không vay product semantics. | Theo semantic order của graph và giữ association với `instrument-cashflow-expansion`. |
| `selected-node-equation-and-known-discount-factors` | Sở hữu evidence, action và state của `selected-node-equation-and-known-discount-factors` mà không vay product semantics. | Theo semantic order của graph và giữ association với `dependency-ordered-maturity-nodes`. |
| `solver-and-interpolation-policy` | Sở hữu solver và interpolation policy áp dụng cho selected node. | Là peer của selected equation và không được bypass known-factor dependencies. |
| `zero-discount-forward-curve` | Sở hữu evidence, action và state của `zero-discount-forward-curve` mà không vay product semantics. | Theo semantic order của graph và giữ association với `solver-and-interpolation-policy`. |
| `repricing-residual-and-arbitrage-diagnostics` | Sở hữu evidence, action và state của `repricing-residual-and-arbitrage-diagnostics` mà không vay product semantics. | Theo semantic order của graph và giữ association với `zero-discount-forward-curve`. |
| `approved-curve-version` | Sở hữu evidence, action và state của `approved-curve-version` mà không vay product semantics. | Theo semantic order của graph và giữ association với `repricing-residual-and-arbitrage-diagnostics`. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các region đồng thời không còn giữ label dễ đọc, association chính xác và complete actions.
- **Đáp ứng topology:** Giữ instrument ladder, dependency nodes, selected equation, curve representations và repricing residuals cùng inspectable.
- **Thay thế điều hướng:** Không có khi mọi required region còn usable đồng thời.
- **Ranh giới sticky:** Chỉ cross-region action đang active được persist; nó reserve space và yield ở short height.
- **Chủ sở hữu overflow:** `market-instrument-ladder` là bounded horizontal overflow owner duy nhất khi cần.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi supporting region ưu tiên thấp làm quan hệ chính không usable.
- **Đáp ứng topology:** Giữ active maturity node, equation và residual làm primary; expose full cash flows, interpolation controls và whole-curve diagnostics qua contextual disclosures.
- **Thay thế điều hướng:** Named disclosure mở region bị thay thế và giữ exact selection.
- **Ranh giới sticky:** Action chỉ persist khi exact target và status còn visible; action về normal flow ở short height.
- **Chủ sở hữu overflow:** Bounded owner của wide giữ trục duy nhất và có keyboard alternative.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task regions đồng thời không giữ được readable evidence và control 44×44 CSS px.
- **Đáp ứng topology:** Tuần tự convention set, maturity chưa giải kế tiếp, instrument, cash flows đã biết và chưa biết, node solve, residual và monotonicity review, rồi advance hoặc rollback; thay chart bằng numeric node route.
- **Thay thế điều hướng:** Primary-pane sequence có Back/Next khôi phục selection, state và scroll context.
- **Ranh giới sticky:** Bottom action reserve content space, không che focus và yield ở short height.
- **Chủ sở hữu overflow:** Numeric hoặc list equivalent thay bounded grid; không có page-level horizontal scroll.

### Reflow

- Semantic và DOM order là `curve-bootstrap` → `valuation-date-currency-collateral-and-convention-set` → `market-instrument-ladder` → `instrument-cashflow-expansion` → `dependency-ordered-maturity-nodes` → `selected-node-equation-and-known-discount-factors` → `solver-and-interpolation-policy` → `zero-discount-forward-curve` → `repricing-residual-and-arbitrage-diagnostics` → `approved-curve-version`.
- Zoom, long translation, enlarged controls và text pressure kích hoạt cùng topology transformations.
- CSS không reorder visual sequence khác keyboard hoặc assistive-technology order.
- Ordinary content không tạo page-level horizontal scroll.

### Ngang bằng tương tác

- Mọi selection, action, explanation, retry và recovery của wide đều reachable ở intermediate và compact.
- Topology change giữ exact entity, filters, data state và pending hoặc completed result.
- Dynamic update announce contextual status mà không steal focus.
- Modal nếu có phải trap focus, hỗ trợ Escape/Cancel và trả focus về exact trigger.
- Color, position và geometry có text hoặc structural equivalent.

## Nghĩa vụ trạng thái

| Trạng thái | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Khởi tạo / loading | `valuation-date-currency-collateral-and-convention-set` | Nêu scope và region đang chờ; giữ semantic position. |
| Sẵn sàng | `market-instrument-ladder` | Expose đầy đủ dominant task và required associations. |
| Rỗng / không áp dụng | `instrument-cashflow-expansion` | Phân biệt meaningful absence với unavailable evidence. |
| Lỗi / thử lại | `dependency-ordered-maturity-nodes` | Giữ valid context, nêu failed owner và cung cấp local retry. |
| Quyền / không khả dụng | `repricing-residual-and-arbitrage-diagnostics` | Không suy diễn hidden evidence là absent; cung cấp safe exit. |
| Đang chờ | `repricing-residual-and-arbitrage-diagnostics` | Chặn duplicate, giữ exact target và announce progress. |
| Thành công | `approved-curve-version` | Expose outcome, giữ context và next valid action. |
| Cũ / xung đột | `valuation-date-currency-collateral-and-convention-set` | Giữ last safe value và yêu cầu explicit recovery. |
| Chuyển focus | `approved-curve-version` | Chỉ move focus tới modal hoặc error summary rồi trả exact trigger. |
| Trình bày responsive | `curve-bootstrap` | Giữ task, state, selection và recovery khi topology đổi. |

Applicable state family: market data loading/current/stale; instrument included/excluded/invalid; convention incomplete; dependency blocked; node unsolved/solving/solved/failed; discount factor invalid; interpolation discontinuity; repricing inside/outside tolerance; arbitrage warning; curve draft/approved/superseded; rollback complete.

## Ranh giới

### Chấp nhận

- Chấp nhận khi cash flows được expand trước node solving.
- Chấp nhận khi maturity dependencies quyết định solve order.
- Chấp nhận khi mọi included instrument có repricing residual trước publication.

### Từ chối

- Từ chối `scenario-sensitivity-modeler`; đây là `AR-YC-90` evidence và phải route tới adjacent archetype.
- Từ chối `calculation-estimate-flow`; đây là `AR-YC-91` evidence và phải route tới adjacent archetype.
- Từ chối `chart-specification-authoring-studio`; đây là `AR-YC-92` evidence và phải route tới adjacent archetype.
- Từ chối `generic rate dashboard`; đây là `AR-YC-93` evidence và phải route tới adjacent archetype.

### Phán quyết ranh giới

Trả `accept` chỉ khi dominant task, complete region graph và compact interaction parity cùng đúng. Trả `reject` cho mọi rejection code. Trả `needs-evidence` khi required owner hoặc relationship chưa resolve. `duplicate-or-variation` áp dụng khi khác biệt chỉ là noun, count, density, color, component hoặc state.

## Bàn giao

- **Grammar handoff:** Gắn product-specific owners, labels, permitted actions, eligibility và truthful state meaning vào regions đã khai báo.
- **Principles handoff:** Resolve exact grid, measure, gap, size, alignment, sticky offset, bounded overflow và relationship-driven transition points.
- Không handoff nào được xóa region, đổi dominant task hoặc giảm interaction parity.

## Bằng chứng nghiên cứu không ràng buộc

### Ranh giới bằng chứng

Research bên ngoài là advisory evidence, không phải product truth. Nguồn hỗ trợ synthesis task relationships, responsive behavior và accessibility obligations; nguồn không đặt StarCi owner, không chọn exact geometry và không cấp quyền copy interface.

### Nguồn

| Nguồn | Điều nguồn hỗ trợ | Điều nguồn không chứng minh |
|---|---|---|
| [European Central Bank — Yield curve methodology](https://www.ecb.europa.eu/stats/financial_markets_and_interest_rates/euro_area_yield_curves/shared/pdf/technical_notes.pdf) | Official zero, forward, and par curve estimation concepts and input selection. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |
| [Bank of England — Yield curves](https://www.bankofengland.co.uk/statistics/yield-curves) | Official curve families, source-instrument boundaries, revisions, and publication context. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Reflow with a bounded exception for the numeric curve table. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Sequential focus across dependency-ordered node work. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |

+| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Adaptive pane relationships and readable content regions. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Dense numeric-table scanning and bounded overflow ownership. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Non-disruptive solve, residual, rollback, and publication announcements. | Không chọn archetype, không định nghĩa product truth và không cho phép copy geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức chính thức độc lập và có accessibility evidence từ W3C.

## Đầu ra

```json
{
  "archetypeId": "zero-coupon-yield-curve-bootstrap-workbench",
  "situationCodes": [
    "<matched AR-YC-* codes>"
  ],
  "searchAliases": [
    "curve bootstrap",
    "discount-factor solver",
    "maturity-node curve",
    "instrument repricing"
  ],
  "dominantTask": "Dựng một zero-coupon curve theo ngày bằng cách giải market instruments theo dependency maturity, rồi chứng minh discount factors reprice toàn bộ input trong tolerance đã khai báo.",
  "regions": [
    "curve-bootstrap",
    "valuation-date-currency-collateral-and-convention-set",
    "market-instrument-ladder",
    "instrument-cashflow-expansion",
    "dependency-ordered-maturity-nodes",
    "selected-node-equation-and-known-discount-factors",
    "solver-and-interpolation-policy",
    "zero-discount-forward-curve",
    "repricing-residual-and-arbitrage-diagnostics",
    "approved-curve-version"
  ],
  "regionRelationships": [
    "Every solved maturity node extends the known curve segment and owns discounting for later cash flows; publication requires repricing and arbitrage diagnostics to pass."
  ],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and synchronized disclosure response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "curve-bootstrap → valuation-date-currency-collateral-and-convention-set → market-instrument-ladder → instrument-cashflow-expansion → dependency-ordered-maturity-nodes → selected-node-equation-and-known-discount-factors → solver-and-interpolation-policy → zero-discount-forward-curve → repricing-residual-and-arbitrage-diagnostics → approved-curve-version",
    "navigationReplacement": "<none or explicit replacement>",
    "stickyBehavior": "<reserved-space behavior and yield condition>",
    "overflowOwner": "<single bounded owner>",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": [
    "market data loading/current/stale",
    "instrument included/excluded/invalid",
    "convention incomplete",
    "dependency blocked",
    "node unsolved/solving/solved/failed",
    "discount factor invalid",
    "interpolation discontinuity",
    "repricing inside/outside tolerance",
    "arbitrage warning",
    "curve draft/approved/superseded",
    "rollback complete"
  ],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": [
    "<product meaning and semantic owners>"
  ],
  "principlesHandoff": [
    "<unresolved geometry only>"
  ],
  "confidence": "<high | medium | low>",
  "evidence": [
    "<official task research>",
    "<accessibility research>"
  ]
}
```
