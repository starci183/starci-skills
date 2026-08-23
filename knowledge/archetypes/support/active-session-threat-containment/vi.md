# Khoanh vùng đe dọa phiên đang hoạt động

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | active-session-threat-containment |
| Family | support |
| Dominant task | Xác định session hoặc device đáng ngờ, giữ current trusted access path, contain threat và hoàn thành credential-recovery follow-up. |
| Search aliases | active-session-threat-containment; session containment; suspicious device revoke; self-lockout prevention |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Xác định session hoặc device đáng ngờ, giữ current trusted access path, contain threat và hoàn thành credential-recovery follow-up.
- Mỗi required region có một semantic owner; supporting context không lấy dominant task.
- DOM order, reading order và focus order giữ nguyên meaning qua wide, intermediate và compact.
- Grammar cung cấp product facts; Principles resolve exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-AST-01 | Xác định session hoặc device đáng ngờ, giữ current trusted access path, contain threat và hoàn thành credential-recovery follow-up. | required positive evidence |
| AR-AST-02 | Critical region relationship và owner separation đều có bằng chứng. | required relationship evidence |
| AR-AST-03 | Wide relationship không còn hoạt động nhưng compact vẫn giữ task, state và recovery. | responsive transformation trigger |
| AR-AST-04 | Error, permission, pending, success và stale/conflict đều có bounded recovery. | required state evidence |
| AR-AST-90 | Reject operational collection, generic account-security list, incident command và credential rotation đơn lẻ. | reject |
| AR-AST-91 | Khác biệt chỉ là product noun, density, color, component, state skin hoặc card count. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-AST-01, AR-AST-02 và AR-AST-03 có bằng chứng, không có AR-AST-90 hoặc AR-AST-91, và mọi required region vẫn cần thiết ở cả ba topology. Trả needs-evidence khi owner, relation hoặc transformation chưa resolve.

## Region graph

~~~text
session-containment
├─ current-trusted-session
├─ device-session-groups
├─ sign-in-risk-evidence
├─ suspicious-selection
├─ containment-actions
├─ credential-recovery-followup
└─ security-receipt
~~~

Critical relationship: Current trusted session là invariant được bảo vệ; mọi destructive containment action kiểm self-lockout risk trước execution.

### Nghĩa vụ vùng

| Region ID | Owner | Required relationship |
|---|---|---|
| session-containment | Sở hữu boundary của dominant task và chứa mọi required region mà không tạo product semantics. | Chứa current-trusted-session, device-session-groups, sign-in-risk-evidence, suspicious-selection, containment-actions, credential-recovery-followup, security-receipt và giữ owner độc lập của từng region. |
| current-trusted-session | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ session-containment và gates device-session-groups mà không gộp authority. |
| device-session-groups | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ current-trusted-session và gates sign-in-risk-evidence mà không gộp authority. |
| sign-in-risk-evidence | Sở hữu source evidence, provenance, freshness và availability; không tự quyết định outcome. | Nhận context từ device-session-groups và gates suspicious-selection mà không gộp authority. |
| suspicious-selection | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ sign-in-risk-evidence và gates containment-actions mà không gộp authority. |
| containment-actions | Sở hữu editable decision state, validation và pending guard cho stage được đặt tên. | Nhận context từ suspicious-selection và gates credential-recovery-followup mà không gộp authority. |
| credential-recovery-followup | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ containment-actions và gates security-receipt mà không gộp authority. |
| security-receipt | Sở hữu bounded outcome, receipt hoặc recovery route sau khi mọi upstream gate đã pass. | Nhận verified state từ credential-recovery-followup và phát outcome hoặc recovery hữu hạn. |

## Responsive contract

### Wide

- Topology response: Keep session groups, risk evidence, current trusted status, suspicious selection, and containment actions simultaneously visible.
- Failure trigger: simultaneous regions làm hẹp readable measure, che state hoặc phá named relationship.
- Navigation replacement: chưa cần khi các vùng còn đồng hiện; sticky chỉ dành cho orientation context vừa viewport.
- Sticky boundary: tự yield ở short-height và không che focused control.
- Overflow owner: page own vertical overflow; chỉ intrinsic matrix mới own bounded horizontal overflow.

### Intermediate

- Topology response: Make suspicious sessions and risk evidence primary while the current-safe-session status persists.
- Failure trigger: supporting persistence cạnh tranh primary-task measure hoặc focus.
- Navigation replacement: named trigger mở supporting dialog; Escape hoặc Cancel đóng và focus trở đúng trigger.
- Sticky boundary: persistent context tự yield ở short-height; dialog body own bounded vertical overflow.
- Overflow owner: page giữ vertical overflow; supporting dialog chỉ own overflow bên trong boundary của nó.

### Compact

- Topology response: Stage current safe session, suspicious session, risk evidence, containment, credential recovery, then security receipt.
- Failure trigger: multi-pane relation không còn operable với body text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay pane adjacency; Back giữ selection, draft và recovery state.
- Sticky boundary: không fixed action bar; focused content luôn visible.
- Overflow owner: không page-level horizontal scroll; intrinsic matrix trở thành grouped records.

### Reflow

Thứ tự region graph là DOM order và reading order ở mọi width. CSS không reorder semantics. Text, localization, zoom và spacing growth làm region cao hơn hoặc trigger topology change; content không bị clip. State sống qua việc region đi vào hoặc ra supporting pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và outcome. Dynamic status được announce bằng polite live region mà không cướp focus. Modal giữ focus, hỗ trợ Escape hoặc Cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Domain state catalog giữ stable identifiers để EN/VI/context đồng bộ: session active/expired/suspicious; device trusted/unknown; risk loading/high/low; revoke selected/all; self-lockout blocked; credential reset pending; recovery method unavailable; receipt.

| State family | Obligation | Focus transition | Responsive presentation |
|---|---|---|---|
| initial/loading | Giữ known anatomy và nêu region đang chờ. | Không tự move focus. | Giữ cùng stage identity. |
| ready | Hiển thị consistent fictional data và current selection. | Focus ở activating control. | Giữ selection qua transformation. |
| empty/not-applicable | Giải thích vì sao trống và valid next step. | Chỉ move đến recovery khi cần continuation. | Không xóa required region khác. |
| error/retry | Gắn error với owner và cung cấp bounded retry. | Multi-error focus vào summary; retry trả đúng action. | Error không chỉ dùng màu. |
| permission/unavailable | Giữ orientation và giải thích limitation. | Không focus locked control. | Cùng reason ở mọi topology. |
| pending | Chặn duplicate và giữ action meaning. | Không cướp focus để báo progress. | State ở cùng action owner. |
| success | Confirm outcome và valid continuation. | Chỉ move focus nếu giúp continuation. | Không tạo source of truth thứ hai. |
| stale/conflict | Nêu changed version và giữ safe input. | Focus contextual recovery choice. | Selection sống qua transformation. |
| domain states | Giữ đầy đủ state identifiers: session active/expired/suspicious; device trusted/unknown; risk loading/high/low; revoke selected/all; self-lockout blocked; credential reset pending; recovery method unavailable; receipt. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Accept khi dominant task cần chính region graph này, critical relationship tạo topology riêng, và mọi responsive state giữ task cùng recovery parity.

### Từ chối

Reject operational collection, generic account-security list, incident command và credential rotation đơn lẻ. Cũng reject duplicate-or-variation khi candidate chỉ đổi noun, density, component hoặc visual state.

### Phán quyết ranh giới

Kết quả hợp lệ là accept, reject, duplicate-or-variation hoặc needs-evidence theo Situation-code rule; visual preference không phải evidence.

## Handoff

- Grammar nhận real facts, semantic owners, permissions, states và action consequences.
- Principles nhận exact grid, measure, gaps, sizing, alignment, overflow, thresholds, sticky offsets và focus accommodation.
- Direction nhận visual character; template chỉ là một conforming realization.

## Bằng chứng research không ràng buộc

### Ranh giới bằng chứng

Các official source dưới đây chỉ là advisory evidence. Chúng không phải product truth, không khẳng định source organization đặt tên archetype tổng hợp này và không cấp quyền copy geometry, component tree, noun hoặc breakpoint.

### Nguồn

| Source | What it supports | What it does not prove |
|---|---|---|
| [NIST — Session management](https://pages.nist.gov/800-63-4/sp800-63b/session/) | Hỗ trợ session integrity, termination, and reauthentication. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [Google Account Help — Devices with account access](https://support.google.com/accounts/answer/3067630?hl=en) | Hỗ trợ reviewing device sessions and signing out unfamiliar access. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Hỗ trợ keeping destructive-action focus visible around persistent safety status. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |

## Output

~~~json
{
  "archetypeId": "active-session-threat-containment",
  "matchedSituationCodes": [
    "AR-AST-01",
    "AR-AST-02",
    "AR-AST-03"
  ],
  "aliases": [
    "active-session-threat-containment",
    "session containment",
    "suspicious device revoke",
    "self-lockout prevention"
  ],
  "dominantTask": "Identify suspicious sessions or devices, preserve the current trusted access path, contain threats, and complete credential-recovery follow-up.",
  "regions": [
    "session-containment",
    "current-trusted-session",
    "device-session-groups",
    "sign-in-risk-evidence",
    "suspicious-selection",
    "containment-actions",
    "credential-recovery-followup",
    "security-receipt"
  ],
  "relationships": [
    "The current trusted session is a protected invariant; every destructive containment action checks self-lockout risk before execution."
  ],
  "responsive": {
    "wide": "Keep session groups, risk evidence, current trusted status, suspicious selection, and containment actions simultaneously visible.",
    "intermediate": "Make suspicious sessions and risk evidence primary while the current-safe-session status persists.",
    "compact": "Stage current safe session, suspicious session, risk evidence, containment, credential recovery, then security receipt.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "session-containment → current-trusted-session → device-session-groups → sign-in-risk-evidence → suspicious-selection → containment-actions → credential-recovery-followup → security-receipt",
    "navigationReplacement": "An anchored supporting pane at intermediate and a staged Previous/Next selector at compact.",
    "stickyBehavior": "Only orientation context may persist, and it yields at short height without obscuring focus.",
    "overflowOwner": "The page owns vertical overflow; no page-level horizontal overflow is allowed.",
    "interactionParity": "Every action, state, pending guard, recovery path, and focus return remains available across bands."
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
    "focus transition",
    "session active/expired/suspicious; device trusted/unknown; risk loading/high/low; revoke selected/all; self-lockout blocked; credential reset pending; recovery method unavailable; receipt"
  ],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [
    "product facts",
    "semantic owners",
    "permissions and consequences",
    "real state transitions"
  ],
  "principlesHandoff": [
    "exact geometry",
    "measure and overflow",
    "content-driven thresholds",
    "sticky offsets",
    "focus accommodation"
  ],
  "confidence": "high when the positive situations and critical relationship are evidenced; otherwise needs-evidence",
  "evidenceClasses": [
    "official task-domain guidance",
    "official independent design or service guidance",
    "official accessibility guidance"
  ]
}
~~~

Không trả class, token, component, source path, fixed breakpoint hoặc invented product fact.

