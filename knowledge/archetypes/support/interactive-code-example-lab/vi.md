# Phòng thực hành ví dụ mã tương tác

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | interactive-code-example-lab |
| Family | support |
| Dominant task | Học một khái niệm bằng cách sửa ví dụ mã có ranh giới và quan sát preview, console cùng bằng chứng test đồng bộ. |
| Search aliases | interactive-code-example-lab; interactive code example lab |
| Authority | Topology tác vụ, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Học một khái niệm bằng cách sửa ví dụ mã có ranh giới và quan sát preview, console cùng bằng chứng test đồng bộ.
- Mỗi vùng có một owner ngữ nghĩa; supporting context không chiếm dominant task.
- DOM order, reading order và focus order giữ nguyên ý nghĩa qua wide, intermediate và compact.
- Grammar cung cấp dữ kiện sản phẩm; Principles giải exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-ICL-01 | Học một khái niệm bằng cách sửa ví dụ mã có ranh giới và quan sát preview, console cùng bằng chứng test đồng bộ. | tín hiệu dương bắt buộc |
| AR-ICL-02 | Mọi vùng bắt buộc và quan hệ quan trọng đều có owner độc lập. | tín hiệu dương bắt buộc |
| AR-ICL-03 | Quan hệ wide không còn hoạt động nhưng compact vẫn phải giữ task, state và recovery. | kích hoạt transformation |
| AR-ICL-90 | nhu cầu là API console, IDE production, mẫu tĩnh, query builder hoặc form preview chung. | reject |
| AR-ICL-91 | Khác biệt chỉ là product noun, density, màu, component hoặc số lượng card. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-ICL-01 và AR-ICL-02 đều có bằng chứng, không có AR-ICL-90 hoặc AR-ICL-91, và region graph vẫn cần thiết ở cả ba topology. Nếu owner hoặc transformation chưa rõ, trả needs-evidence.

## Region graph

~~~text
code-lab
├─ lesson-goal-and-instructions
├─ editable-code-region
├─ live-preview-or-simulator
├─ console-and-test-evidence
├─ reset-solution-controls
└─ explanation-and-next-step
~~~

Quan hệ quan trọng: Code, preview, console, and tests share one explicit run version; editing marks prior output stale.

### Nghĩa vụ vùng

| Region ID | Owner | Quan hệ bắt buộc |
|---|---|---|
| code-lab | Sở hữu ranh giới dominant task của trang và chứa mọi region bắt buộc; không tự tạo semantic sản phẩm. | Chứa lesson-goal-and-instructions, editable-code-region, live-preview-or-simulator, console-and-test-evidence, reset-solution-controls, explanation-and-next-step nhưng giữ owner độc lập của từng region. |
| lesson-goal-and-instructions | Sở hữu đúng task fact hoặc stage được đặt tên và không lấy authority của region lân cận. | Định hướng editable-code-region mà không thay owner của nó. |
| editable-code-region | Sở hữu đúng task fact hoặc stage được đặt tên và không lấy authority của region lân cận. | Nhận context từ lesson-goal-and-instructions và ràng buộc live-preview-or-simulator mà không gộp authority. |
| live-preview-or-simulator | Sở hữu interpretation hoặc consequence preview suy ra; không trở thành nguồn input thứ hai. | Nhận context từ editable-code-region và ràng buộc console-and-test-evidence mà không gộp authority. |
| console-and-test-evidence | Sở hữu evidence truy nguyên được cùng trạng thái freshness, availability và permission. | Nhận context từ live-preview-or-simulator và ràng buộc reset-solution-controls mà không gộp authority. |
| reset-solution-controls | Sở hữu input hoặc lựa chọn hiện tại cùng trạng thái pending và recovery của nó. | Nhận context từ console-and-test-evidence và ràng buộc explanation-and-next-step mà không gộp authority. |
| explanation-and-next-step | Sở hữu đúng task fact hoặc stage được đặt tên và không lấy authority của region lân cận. | Nhận trạng thái đã verify từ reset-solution-controls và phát outcome hoặc recovery path hữu hạn. |

## Responsive contract

### Wide

- Coordinate instructions, editor, preview, and evidence panes; only code and console own bounded overflow.
- Failure trigger: các vùng đồng thời làm hẹp nội dung, che trạng thái hoặc phá quan hệ owner.
- Navigation replacement: không cần nếu các vùng còn đồng hiện; sticky chỉ dành cho context vừa viewport.
- Overflow owner: page theo trục dọc; chỉ region có bản chất hai chiều mới own overflow có giới hạn.

### Intermediate

- Collapse instructions and alternate preview with evidence while the run version stays visible.
- Failure trigger: supporting persistence cạnh tranh measure hoặc focus với primary task.
- Navigation replacement: trigger có tên mở temporary pane, Escape đóng và focus trở đúng trigger.
- Sticky boundary tự yield ở short-height; page vẫn là overflow owner.

### Compact

- Stage instructions, editor, run, preview, tests, then explanation; explicit switches preserve code and output.
- Failure trigger: nhiều pane không còn đồng thời operable với text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay quan hệ pane; Back giữ selection và draft.
- Không có page-level horizontal scroll; sticky/fixed surface không che content hoặc focus.

### Reflow

Thứ tự ngữ nghĩa theo region graph là DOM order và reading order ở mọi width. CSS không reorder. Text, localization, zoom và spacing growth làm vùng cao hơn hoặc chuyển topology; không clip nội dung. Trạng thái trong vùng giữ nguyên khi vùng được chuyển vào hoặc ra temporary pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và kết quả. Status động được announce qua polite live region mà không tự cướp focus. Dialog giữ focus, hỗ trợ Escape/cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Danh mục trạng thái domain (giữ stable state identifiers để EN/VI/context đồng nhất): starter/dirty code; syntax error; running; preview success/runtime failure; tests pass/fail; stale output; reset confirmation; solution reveal; reduced-motion simulator.

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
| domain states | Code changed; preview and tests are marked stale. Version 2 ran locally; preview and console now share that version. One test failed with a text explanation and no focus theft. Starter restored after confirmation; reduced-motion behavior remains equivalent. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Chấp nhận khi dominant task cần đúng region graph, quan hệ quan trọng tạo topology riêng và cả ba responsive state giữ được task/recovery parity.

### Từ chối

Từ chối khi nhu cầu là API console, IDE production, mẫu tĩnh, query builder hoặc form preview chung, hoặc khi chỉ đổi noun/card/density của archetype khác.

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
| [W3C WAI APG — Keyboard interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | Hỗ trợ keyboard-complete interaction and visible focus. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [Apple HIG — Split views](https://developer.apple.com/design/human-interface-guidelines/split-views) | Hỗ trợ adjacent-pane transformation. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Hỗ trợ responsive region relationships and minimum touch targets. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |

## Đầu ra

~~~json
{
  "archetypeId": "interactive-code-example-lab",
  "matchedSituationCodes": [
    "AR-ICL-01",
    "AR-ICL-02"
  ],
  "aliases": [
    "interactive-code-example-lab",
    "interactive code example lab"
  ],
  "dominantTask": "Learn one concept by editing a bounded code example and observing synchronized preview, console, and test evidence.",
  "regions": [
    "code-lab",
    "lesson-goal-and-instructions",
    "editable-code-region",
    "live-preview-or-simulator",
    "console-and-test-evidence",
    "reset-solution-controls",
    "explanation-and-next-step"
  ],
  "relationships": [
    "Code, preview, console, and tests share one explicit run version; editing marks prior output stale."
  ],
  "responsive": {
    "wide": "Coordinate instructions, editor, preview, and evidence panes; only code and console own bounded overflow.",
    "intermediate": "Collapse instructions and alternate preview with evidence while the run version stays visible.",
    "compact": "Stage instructions, editor, run, preview, tests, then explanation; explicit switches preserve code and output.",
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
