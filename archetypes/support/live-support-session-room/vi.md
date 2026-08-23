# Phòng phiên hỗ trợ trực tiếp

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | live-support-session-room |
| Family | support |
| Dominant task | Cộng tác quanh một phiên chia sẻ trong khi hội thoại, chẩn đoán, đồng thuận và quyền điều khiển luôn rõ ràng. |
| Search aliases | live-support-session-room; live support session room |
| Authority | Topology tác vụ, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Cộng tác quanh một phiên chia sẻ trong khi hội thoại, chẩn đoán, đồng thuận và quyền điều khiển luôn rõ ràng.
- Mỗi vùng có một owner ngữ nghĩa; supporting context không chiếm dominant task.
- DOM order, reading order và focus order giữ nguyên ý nghĩa qua wide, intermediate và compact.
- Grammar cung cấp dữ kiện sản phẩm; Principles giải exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-LSS-01 | Cộng tác quanh một phiên chia sẻ trong khi hội thoại, chẩn đoán, đồng thuận và quyền điều khiển luôn rõ ràng. | tín hiệu dương bắt buộc |
| AR-LSS-02 | Mọi vùng bắt buộc và quan hệ quan trọng đều có owner độc lập. | tín hiệu dương bắt buộc |
| AR-LSS-03 | Quan hệ wide không còn hoạt động nhưng compact vẫn phải giữ task, state và recovery. | kích hoạt transformation |
| AR-LSS-90 | trang chỉ là chat, media theater, remote dashboard, case timeline hoặc screen share chung. | reject |
| AR-LSS-91 | Khác biệt chỉ là product noun, density, màu, component hoặc số lượng card. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-LSS-01 và AR-LSS-02 đều có bằng chứng, không có AR-LSS-90 hoặc AR-LSS-91, và region graph vẫn cần thiết ở cả ba topology. Nếu owner hoặc transformation chưa rõ, trả needs-evidence.

## Region graph

~~~text
support-session
├─ session-identity-and-safety
├─ shared-session-stage
├─ transport-and-control-handoff
├─ live-conversation
├─ diagnostic-context
├─ participant-and-consent-state
└─ session-event-log
~~~

Quan hệ quan trọng: The shared stage and current controller are primary; consent and participant state remain visible through every handoff.

### Nghĩa vụ vùng

| Region ID | Owner | Quan hệ bắt buộc |
|---|---|---|
| support-session | Sở hữu ranh giới dominant task của trang và chứa mọi region bắt buộc; không tự tạo semantic sản phẩm. | Chứa session-identity-and-safety, shared-session-stage, transport-and-control-handoff, live-conversation, diagnostic-context, participant-and-consent-state, session-event-log nhưng giữ owner độc lập của từng region. |
| session-identity-and-safety | Sở hữu dữ kiện ổn định về subject, scope và orientation cho mọi quyết định phía sau. | Định hướng shared-session-stage mà không thay owner của nó. |
| shared-session-stage | Sở hữu đúng task fact hoặc stage được đặt tên và không lấy authority của region lân cận. | Nhận context từ session-identity-and-safety và ràng buộc transport-and-control-handoff mà không gộp authority. |
| transport-and-control-handoff | Sở hữu input hoặc lựa chọn hiện tại cùng trạng thái pending và recovery của nó. | Nhận context từ shared-session-stage và ràng buộc live-conversation mà không gộp authority. |
| live-conversation | Sở hữu đúng task fact hoặc stage được đặt tên và không lấy authority của region lân cận. | Nhận context từ transport-and-control-handoff và ràng buộc diagnostic-context mà không gộp authority. |
| diagnostic-context | Sở hữu evidence truy nguyên được cùng trạng thái freshness, availability và permission. | Nhận context từ live-conversation và ràng buộc participant-and-consent-state mà không gộp authority. |
| participant-and-consent-state | Sở hữu invariant hoặc trạng thái suy ra được đặt tên và biểu đạt bằng chữ, không chỉ bằng màu. | Nhận context từ diagnostic-context và ràng buộc session-event-log mà không gộp authority. |
| session-event-log | Sở hữu evidence truy nguyên được cùng trạng thái freshness, availability và permission. | Nhận trạng thái đã verify từ participant-and-consent-state và phát outcome hoặc recovery path hữu hạn. |

## Responsive contract

### Wide

- Keep the shared stage primary with conversation and diagnostics available; controller and consent never disappear.
- Failure trigger: các vùng đồng thời làm hẹp nội dung, che trạng thái hoặc phá quan hệ owner.
- Navigation replacement: không cần nếu các vùng còn đồng hiện; sticky chỉ dành cho context vừa viewport.
- Overflow owner: page theo trục dọc; chỉ region có bản chất hai chiều mới own overflow có giới hạn.

### Intermediate

- Move diagnostics into the temporary pane while stage, conversation, and control remain usable.
- Failure trigger: supporting persistence cạnh tranh measure hoặc focus với primary task.
- Navigation replacement: trigger có tên mở temporary pane, Escape đóng và focus trở đúng trigger.
- Sticky boundary tự yield ở short-height; page vẫn là overflow owner.

### Compact

- Show the stage first; conversation and diagnostics become named stages, and control handoff requires confirmation.
- Failure trigger: nhiều pane không còn đồng thời operable với text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay quan hệ pane; Back giữ selection và draft.
- Không có page-level horizontal scroll; sticky/fixed surface không che content hoặc focus.

### Reflow

Thứ tự ngữ nghĩa theo region graph là DOM order và reading order ở mọi width. CSS không reorder. Text, localization, zoom và spacing growth làm vùng cao hơn hoặc chuyển topology; không clip nội dung. Trạng thái trong vùng giữ nguyên khi vùng được chuyển vào hoặc ra temporary pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và kết quả. Status động được announce qua polite live region mà không tự cướp focus. Dialog giữ focus, hỗ trợ Escape/cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Danh mục trạng thái domain (giữ stable state identifiers để EN/VI/context đồng nhất): connecting/live/reconnecting/ended; view-only/control-requested/granted/revoked; participant joined/left; consent pending; stale diagnostic; message pending/error; recording state.

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
| domain states | Control requested; session remains view-only. Consent confirmed; control granted to Support agent and announced. Control revoked; the local participant is controller again. Participant reconnected; controller, consent, and session history are preserved. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Chấp nhận khi dominant task cần đúng region graph, quan hệ quan trọng tạo topology riêng và cả ba responsive state giữ được task/recovery parity.

### Từ chối

Từ chối khi trang chỉ là chat, media theater, remote dashboard, case timeline hoặc screen share chung, hoặc khi chỉ đổi noun/card/density của archetype khác.

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
| [W3C WAI APG — Modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Hỗ trợ modal focus entry, containment, Escape, and return. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [Apple HIG — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Hỗ trợ adaptive hierarchy and readable regions. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Hỗ trợ responsive region relationships and minimum touch targets. | Không chứng minh dữ kiện sản phẩm, geometry, breakpoint hoặc visual direction. |

## Đầu ra

~~~json
{
  "archetypeId": "live-support-session-room",
  "matchedSituationCodes": [
    "AR-LSS-01",
    "AR-LSS-02"
  ],
  "aliases": [
    "live-support-session-room",
    "live support session room"
  ],
  "dominantTask": "Collaborate around a shared session while conversation, diagnostics, consent, and control ownership remain explicit.",
  "regions": [
    "support-session",
    "session-identity-and-safety",
    "shared-session-stage",
    "transport-and-control-handoff",
    "live-conversation",
    "diagnostic-context",
    "participant-and-consent-state",
    "session-event-log"
  ],
  "relationships": [
    "The shared stage and current controller are primary; consent and participant state remain visible through every handoff."
  ],
  "responsive": {
    "wide": "Keep the shared stage primary with conversation and diagnostics available; controller and consent never disappear.",
    "intermediate": "Move diagnostics into the temporary pane while stage, conversation, and control remain usable.",
    "compact": "Show the stage first; conversation and diagnostics become named stages, and control handoff requires confirmation.",
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
