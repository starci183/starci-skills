# Trình phân tích cân bằng khối lượng quy trình

## LOADS

None.

## Hồ sơ

### Danh tính

| Trường | Giá trị |
|---|---|
| Archetype ID | `process-mass-balance-analyzer` |
| Nhóm | Work |
| Tác vụ chi phối | Reconcile vật chất được bảo toàn qua mạng lưới unit operation, stream và vòng recycle, đồng thời định vị mất cân bằng và bất định. |
| Bí danh tìm kiếm | `mass balance`, `process streams`, `conservation network`, `recycle reconciliation` |
| Thẩm quyền | Topology macro dùng chung, trung lập sản phẩm. |

### Bất biến

- Mỗi unit operation và toàn mạng tuần hoàn sở hữu phương trình bảo toàn; đại lượng trên stream nối cân bằng cục bộ với toàn cục.
- Region graph bắt buộc giữ nguyên `mass-balance-analyzer → process-and-case-context → unit-operation-flow-graph → stream-composition-ledger → local-and-global-conservation-equations → imbalance-priority → selected-unit-or-stream-detail → uncertainty-and-reconciliation → export`.
- DOM order, reading order và meaningful focus order phải giống nhau.
- Grammar sở hữu product meaning; Principles sở hữu geometry chưa resolve; Direction sở hữu visual character.
- Các trạng thái loading, ready, empty, error, unavailable, pending, success và stale/conflict phải giữ dominant task.
- Edges must carry conserved quantities through a recirculating network and reconcile local with global equations.

## Nhận diện

### Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `AR-PM-01` | Dominant task là: Reconcile vật chất được bảo toàn qua mạng lưới unit operation, stream và vòng recycle, đồng thời định vị mất cân bằng và bất định. | Bằng chứng ứng viên. |
| `AR-PM-02` | Toàn bộ region graph bắt buộc hiện diện về mặt semantics. | Bằng chứng bắt buộc. |
| `AR-PM-03` | Compact giữ selection, action, state và recovery của wide. | Bằng chứng bắt buộc. |
| `AR-PM-04` | Mỗi unit operation và toàn mạng tuần hoàn sở hữu phương trình bảo toàn; đại lượng trên stream nối cân bằng cục bộ với toàn cục. | Bằng chứng quan hệ bắt buộc. |
| `AR-PM-90` | Dominant task là dependency health graph. | Từ chối. |
| `AR-PM-91` | Dominant task là one bridge waterfall. | Từ chối. |
| `AR-PM-92` | Dominant task là quota editor. | Từ chối. |
| `AR-PM-93` | Dominant task là scenario modeler. | Từ chối. |

### Quy tắc chọn

Chỉ chọn `process-mass-balance-analyzer` khi `AR-PM-01`, `AR-PM-02`, `AR-PM-03` và `AR-PM-04` có bằng chứng, đồng thời không mã loại trừ nào từ `AR-PM-90` đến `AR-PM-93` đúng. Trả `needs-evidence` khi thiếu owner hoặc quan hệ bắt buộc. Trả `reject` khi có bất kỳ mã loại trừ nào.

## Sơ đồ vùng

```text
mass-balance-analyzer
└─ process-and-case-context
   └─ unit-operation-flow-graph
      └─ stream-composition-ledger
         └─ local-and-global-conservation-equations
            └─ imbalance-priority
               └─ selected-unit-or-stream-detail
                  └─ uncertainty-and-reconciliation
                     └─ export
```

- Quan hệ bắt buộc: Mỗi unit operation và toàn mạng tuần hoàn sở hữu phương trình bảo toàn; đại lượng trên stream nối cân bằng cục bộ với toàn cục.

### Nghĩa vụ vùng

| Vùng | Chủ sở hữu | Quan hệ |
|---|---|---|
| `mass-balance-analyzer` | Sở hữu dominant task cấp trang và trạng thái của toàn graph. | Là gốc của graph. |
| `process-and-case-context` | Sở hữu bằng chứng, trạng thái và action của process-and-case-context mà không vay product semantics. | Theo sau `mass-balance-analyzer` trong semantic order và giữ cùng selection context. |
| `unit-operation-flow-graph` | Sở hữu bằng chứng, trạng thái và action của unit-operation-flow-graph mà không vay product semantics. | Theo sau `process-and-case-context` trong semantic order và giữ cùng selection context. |
| `stream-composition-ledger` | Sở hữu bằng chứng, trạng thái và action của stream-composition-ledger mà không vay product semantics. | Theo sau `unit-operation-flow-graph` trong semantic order và giữ cùng selection context. |
| `local-and-global-conservation-equations` | Sở hữu bằng chứng, trạng thái và action của local-and-global-conservation-equations mà không vay product semantics. | Theo sau `stream-composition-ledger` trong semantic order và giữ cùng selection context. |
| `imbalance-priority` | Sở hữu bằng chứng, trạng thái và action của imbalance-priority mà không vay product semantics. | Theo sau `local-and-global-conservation-equations` trong semantic order và giữ cùng selection context. |
| `selected-unit-or-stream-detail` | Sở hữu bằng chứng, trạng thái và action của selected-unit-or-stream-detail mà không vay product semantics. | Theo sau `imbalance-priority` trong semantic order và giữ cùng selection context. |
| `uncertainty-and-reconciliation` | Sở hữu bằng chứng, trạng thái và action của uncertainty-and-reconciliation mà không vay product semantics. | Theo sau `selected-unit-or-stream-detail` trong semantic order và giữ cùng selection context. |
| `export` | Sở hữu bằng chứng, trạng thái và action của export mà không vay product semantics. | Theo sau `uncertainty-and-reconciliation` trong semantic order và giữ cùng selection context. |

## Hợp đồng responsive

### Wide

- **Điểm kích hoạt thất bại:** Wide kết thúc khi các owner bằng chứng đồng thời không còn giữ label dễ đọc, association xuyên vùng chính xác và action đầy đủ.
- **Đáp ứng topology:** Keep the flow graph, stream ledger, and balance equations visible.
- **Thay thế điều hướng:** Không thay thế khi mọi owner đồng thời còn usable.
- **Ranh giới sticky:** Chỉ action xuyên vùng đang hoạt động được persist; nó reserve space và yield khi chiều cao ngắn không giữ được focus visible.
- **Chủ sở hữu overflow:** Chỉ `unit-operation-flow-graph` được sở hữu bounded overflow hai chiều khi ý nghĩa tác vụ yêu cầu.

### Intermediate

- **Điểm kích hoạt thất bại:** Intermediate bắt đầu khi region persist có ưu tiên thấp nhất làm quan hệ chi phối khó đọc hoặc không vận hành được.
- **Đáp ứng topology:** Make the graph supporting; prioritize the imbalance list and ledger with an active-path summary.
- **Thay thế điều hướng:** Một control pane có tên mở region bị dời với selection và state hiện tại còn nguyên.
- **Ranh giới sticky:** Action persist chỉ còn khi target và status thấy được; nó trở về normal flow ở short height.
- **Chủ sở hữu overflow:** `unit-operation-flow-graph` giữ bounded overflow; prose và control bị dời phải reflow.

### Compact

- **Điểm kích hoạt thất bại:** Compact bắt đầu khi hai task region đồng thời không giữ được evidence dễ đọc và control 44×44 CSS px.
- **Đáp ứng topology:** Use imbalance-first list → selected unit path → inputs or outputs → equation → uncertainty or reconcile; the graph is optional.
- **Thay thế điều hướng:** Control Previous, Next và pane có tên khôi phục selection, state và scroll context.
- **Ranh giới sticky:** Compact step control reserve space, không che focus và yield ở short height.
- **Chủ sở hữu overflow:** `unit-operation-flow-graph` là ngoại lệ bounded duy nhất; mọi nội dung khác dùng page scroll.

### Reflow

- Semantic order và DOM order là `mass-balance-analyzer → process-and-case-context → unit-operation-flow-graph → stream-composition-ledger → local-and-global-conservation-equations → imbalance-priority → selected-unit-or-stream-detail → uncertainty-and-reconciliation → export`.
- Text zoom, bản dịch dài và control phóng lớn kích hoạt cùng topology change theo quan hệ.
- CSS không reorder visual sequence lệch khỏi keyboard hoặc assistive-technology order.
- Label dài được wrap và mọi region ẩn đều có đường reveal accessible có tên.
- Nội dung thông thường không tạo horizontal scroll cấp trang.

### Tương đương tương tác

- Mọi selection, measurement, action, retry và recovery ở wide vẫn reachable tại intermediate và compact.
- Topology change giữ đúng selected item, coordinate hoặc path dùng chung, data state và receipt pending hoặc completed.
- Dynamic update announce một contextual status mà không giật focus.
- Modal giữ focus, hỗ trợ Escape hoặc Cancel và trả focus về đúng trigger.
- Color, position, geometry và visual mark đều có equivalent bằng text hoặc table.
- The fictional network remains imbalanced until the recycle stream converges.

## Nghĩa vụ trạng thái

| Trạng thái | Vùng sở hữu | Nghĩa vụ |
|---|---|---|
| Initial / loading | `process-and-case-context` | Xác định owner đang pending và giữ semantic position. |
| Ready | `unit-operation-flow-graph` | Mở toàn bộ dominant task và evidence đồng bộ. |
| Empty / not applicable | `stream-composition-ledger` | Phân biệt absence có nghĩa với evidence unavailable. |
| Error / retry | `local-and-global-conservation-equations` | Giữ context hợp lệ và cho retry cục bộ mà không reset selection. |
| Permission / unavailable | `imbalance-priority` | Không ngụ ý evidence bị ẩn là không tồn tại; cung cấp alternate route an toàn. |
| Pending | `export` | Chặn action lặp và announce tiến trình mà không di chuyển focus. |
| Success | `export` | Mở kết quả, giữ context và cung cấp next action hợp lệ. |
| Stale / conflict | `process-and-case-context` | Giữ last safe value và yêu cầu recovery rõ ràng. |
| Focus transition | `export` | Chỉ di chuyển focus cho modal hoặc error summary rồi trả về trigger. |
| Responsive presentation | `mass-balance-analyzer` | Giữ selection, state và recovery khi topology đổi. |

State family áp dụng: stream loading, stream missing, unit balanced, unit imbalanced, recycle convergence pending, recycle convergence failure, composition invalid, uncertainty high, reconciliation proposed, reconciliation accepted, export ready.

## Ranh giới

### Chấp nhận

- Chấp nhận khi reconcile vật chất được bảo toàn qua mạng lưới unit operation, stream và vòng recycle, đồng thời định vị mất cân bằng và bất định.
- Chấp nhận khi mỗi unit operation và toàn mạng tuần hoàn sở hữu phương trình bảo toàn; đại lượng trên stream nối cân bằng cục bộ với toàn cục.
- Chấp nhận khi compact giữ đúng task evidence, action và recovery.

### Từ chối

- Từ chối dependency health graph; đây là bằng chứng `AR-PM-90` và phải route tới archetype lân cận.
- Từ chối one bridge waterfall; đây là bằng chứng `AR-PM-91` và phải route tới archetype lân cận.
- Từ chối quota editor; đây là bằng chứng `AR-PM-92` và phải route tới archetype lân cận.
- Từ chối scenario modeler; đây là bằng chứng `AR-PM-93` và phải route tới archetype lân cận.
- Từ chối candidate chỉ khác product noun, count, density, color, component hoặc state dưới dạng `duplicate-or-variation`.

### Phán quyết ranh giới

Chỉ trả `accept` khi dominant task, region graph đầy đủ, quan hệ owner bắt buộc và compact interaction parity đều đúng. Trả `reject` cho mọi rejection code. Trả `needs-evidence` khi owner hoặc quan hệ bắt buộc chưa resolve.

## Bàn giao

- **Bàn giao Grammar:** Gắn owner, label, permission, action và ý nghĩa state trung thực của sản phẩm vào các region đã khai báo.
- **Bàn giao Principles:** Resolve exact grid, measure, gap, alignment, sticky offset, realization overflow bounded và transition point theo quan hệ.
- Không bàn giao nào được xóa region bắt buộc, đổi dominant task hoặc làm yếu interaction parity.

## Bằng chứng nghiên cứu không ràng buộc

### Ranh giới bằng chứng

Research bên ngoài là bằng chứng tư vấn, không phải product truth. Nó hỗ trợ quan hệ tác vụ, adaptive behavior và nghĩa vụ accessibility; nó không đặt tên StarCi owner, không chọn geometry chính xác và không cấp quyền sao chép interface nguồn. Các nguồn đã được mở và kiểm chứng là trang official hiện hành trong batch này.

### Nguồn

| Nguồn | Hỗ trợ điều gì | Không chứng minh điều gì |
|---|---|---|
| [U.S. EPA — SWAMI process analysis guide](https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=300043RS.TXT) | Hỗ trợ unit operations, process flows, and mass-balance calculations. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [NIST — SI Units](https://www.nist.gov/pml/owm/si-units) | Hỗ trợ independent quantity and unit traceability. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [OGC — Web Coverage Service](https://www.ogc.org/standards/wcs/) | Hỗ trợ independent structured quantitative coverage evidence. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |
| [W3C WAI — Complex Images](https://www.w3.org/WAI/tutorials/images/complex/) | Hỗ trợ linear text alternatives for process graphs. | Không chọn archetype này, không định nghĩa product truth và không cho phép sao chép geometry. |

Tập nguồn đại diện cho ít nhất ba tổ chức official độc lập và bao gồm bằng chứng accessibility của W3C.

## Output

```json
{
  "archetypeId": "process-mass-balance-analyzer",
  "situationCodes": ["<matched AR-PM-* codes>"],
  "searchAliases": ["mass balance","process streams","conservation network","recycle reconciliation"],
  "dominantTask": "Reconcile conserved material through a network of unit operations, streams, and recycle loops and locate imbalance and uncertainty.",
  "regions": ["mass-balance-analyzer","process-and-case-context","unit-operation-flow-graph","stream-composition-ledger","local-and-global-conservation-equations","imbalance-priority","selected-unit-or-stream-detail","uncertainty-and-reconciliation","export"],
  "regionRelationships": ["Every unit operation and the whole recirculating network own conservation equations; stream quantities connect local and global balances."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "mass-balance-analyzer → process-and-case-context → unit-operation-flow-graph → stream-composition-ledger → local-and-global-conservation-equations → imbalance-priority → selected-unit-or-stream-detail → uncertainty-and-reconciliation → export",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "unit-operation-flow-graph",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["stream loading","stream missing","unit balanced","unit imbalanced","recycle convergence pending","recycle convergence failure","composition invalid","uncertainty high","reconciliation proposed","reconciliation accepted","export ready"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

