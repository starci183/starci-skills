# Bàn chọn sample theo quy định

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | regulated-sample-selection-workbench |
| Family | work |
| Dominant task | Định nghĩa population và sampling method, generate sample, assess coverage và bias, govern replacement và lock immutable testing handoff. |
| Search aliases | regulated-sample-selection-workbench; audit sample selection; representative sample; replacement governance |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Định nghĩa population và sampling method, generate sample, assess coverage và bias, govern replacement và lock immutable testing handoff.
- Mỗi required region có một semantic owner; supporting context không lấy dominant task.
- DOM order, reading order và focus order giữ nguyên meaning qua wide, intermediate và compact.
- Grammar cung cấp product facts; Principles resolve exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-RSS-01 | Định nghĩa population và sampling method, generate sample, assess coverage và bias, govern replacement và lock immutable testing handoff. | required positive evidence |
| AR-RSS-02 | Critical region relationship và owner separation đều có bằng chứng. | required relationship evidence |
| AR-RSS-03 | Wide relationship không còn hoạt động nhưng compact vẫn giữ task, state và recovery. | responsive transformation trigger |
| AR-RSS-04 | Error, permission, pending, success và stale/conflict đều có bounded recovery. | required state evidence |
| AR-RSS-90 | Reject query builder, experimental randomization design, control testing và generic batch selection. | reject |
| AR-RSS-91 | Khác biệt chỉ là product noun, density, color, component, state skin hoặc card count. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-RSS-01, AR-RSS-02 và AR-RSS-03 có bằng chứng, không có AR-RSS-90 hoặc AR-RSS-91, và mọi required region vẫn cần thiết ở cả ba topology. Trả needs-evidence khi owner, relation hoặc transformation chưa resolve.

## Region graph

~~~text
sample-selection
├─ population-frame-exclusions
├─ method-parameters
├─ generated-sample
├─ coverage-bias-evidence
├─ replacement-exception-log
├─ locked-sample-version
└─ testing-handoff
~~~

Critical relationship: Representativeness và replacement governance sở hữu sample; testing chỉ nhận immutable version đã assess coverage.

### Nghĩa vụ vùng

| Region ID | Owner | Required relationship |
|---|---|---|
| sample-selection | Sở hữu boundary của dominant task và chứa mọi required region mà không tạo product semantics. | Chứa population-frame-exclusions, method-parameters, generated-sample, coverage-bias-evidence, replacement-exception-log, locked-sample-version, testing-handoff và giữ owner độc lập của từng region. |
| population-frame-exclusions | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ sample-selection và gates method-parameters mà không gộp authority. |
| method-parameters | Sở hữu editable decision state, validation và pending guard cho stage được đặt tên. | Nhận context từ population-frame-exclusions và gates generated-sample mà không gộp authority. |
| generated-sample | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ method-parameters và gates coverage-bias-evidence mà không gộp authority. |
| coverage-bias-evidence | Sở hữu source evidence, provenance, freshness và availability; không tự quyết định outcome. | Nhận context từ generated-sample và gates replacement-exception-log mà không gộp authority. |
| replacement-exception-log | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ coverage-bias-evidence và gates locked-sample-version mà không gộp authority. |
| locked-sample-version | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ replacement-exception-log và gates testing-handoff mà không gộp authority. |
| testing-handoff | Sở hữu bounded outcome, receipt hoặc recovery route sau khi mọi upstream gate đã pass. | Nhận verified state từ locked-sample-version và phát outcome hoặc recovery hữu hạn. |

## Responsive contract

### Wide

- Topology response: Keep population and method, generated sample, coverage and bias evidence, and replacement log simultaneously visible.
- Failure trigger: simultaneous regions làm hẹp readable measure, che state hoặc phá named relationship.
- Navigation replacement: chưa cần khi các vùng còn đồng hiện; sticky chỉ dành cho orientation context vừa viewport.
- Sticky boundary: tự yield ở short-height và không che focused control.
- Overflow owner: page own vertical overflow; chỉ intrinsic matrix mới own bounded horizontal overflow.

### Intermediate

- Topology response: Make sample and coverage primary; move method parameters to a drawer.
- Failure trigger: supporting persistence cạnh tranh primary-task measure hoặc focus.
- Navigation replacement: named trigger mở supporting dialog; Escape hoặc Cancel đóng và focus trở đúng trigger.
- Sticky boundary: persistent context tự yield ở short-height; dialog body own bounded vertical overflow.
- Overflow owner: page giữ vertical overflow; supporting dialog chỉ own overflow bên trong boundary của nó.

### Compact

- Topology response: Stage parameters, generated sample, coverage and bias, exceptions and replacements, immutable lock, then testing handoff.
- Failure trigger: multi-pane relation không còn operable với body text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay pane adjacency; Back giữ selection, draft và recovery state.
- Sticky boundary: không fixed action bar; focused content luôn visible.
- Overflow owner: không page-level horizontal scroll; intrinsic matrix trở thành grouped records.

### Reflow

Thứ tự region graph là DOM order và reading order ở mọi width. CSS không reorder semantics. Text, localization, zoom và spacing growth làm region cao hơn hoặc trigger topology change; content không bị clip. State sống qua việc region đi vào hoặc ra supporting pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và outcome. Dynamic status được announce bằng polite live region mà không cướp focus. Modal giữ focus, hỗ trợ Escape hoặc Cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Domain state catalog giữ stable identifiers để EN/VI/context đồng bộ: frame loading/incomplete; exclusion valid/invalid; generation pending; sample selected; coverage sufficient/biased; replacement requested/approved; version unlocked/locked; handoff.

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
| domain states | Giữ đầy đủ state identifiers: frame loading/incomplete; exclusion valid/invalid; generation pending; sample selected; coverage sufficient/biased; replacement requested/approved; version unlocked/locked; handoff. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Accept khi dominant task cần chính region graph này, critical relationship tạo topology riêng, và mọi responsive state giữ task cùng recovery parity.

### Từ chối

Reject query builder, experimental randomization design, control testing và generic batch selection. Cũng reject duplicate-or-variation khi candidate chỉ đổi noun, density, component hoặc visual state.

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
| [U.S. GAO — Financial Audit Manual](https://www.gao.gov/financial-audit-manual) | Hỗ trợ current audit sampling methodology and documentation. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [IBM Carbon — Data table usage](https://carbondesignsystem.com/components/data-table/usage/) | Hỗ trợ explicit sample selection and row state. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ generation, bias, replacement, and lock announcements. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |

## Output

~~~json
{
  "archetypeId": "regulated-sample-selection-workbench",
  "matchedSituationCodes": [
    "AR-RSS-01",
    "AR-RSS-02",
    "AR-RSS-03"
  ],
  "aliases": [
    "regulated-sample-selection-workbench",
    "audit sample selection",
    "representative sample",
    "replacement governance"
  ],
  "dominantTask": "Define a population and sampling method, generate a sample, assess coverage and bias, govern replacements, and lock an immutable testing handoff.",
  "regions": [
    "sample-selection",
    "population-frame-exclusions",
    "method-parameters",
    "generated-sample",
    "coverage-bias-evidence",
    "replacement-exception-log",
    "locked-sample-version",
    "testing-handoff"
  ],
  "relationships": [
    "Representativeness and replacement governance own the sample; testing receives only an immutable, coverage-assessed version."
  ],
  "responsive": {
    "wide": "Keep population and method, generated sample, coverage and bias evidence, and replacement log simultaneously visible.",
    "intermediate": "Make sample and coverage primary; move method parameters to a drawer.",
    "compact": "Stage parameters, generated sample, coverage and bias, exceptions and replacements, immutable lock, then testing handoff.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "sample-selection → population-frame-exclusions → method-parameters → generated-sample → coverage-bias-evidence → replacement-exception-log → locked-sample-version → testing-handoff",
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
    "frame loading/incomplete; exclusion valid/invalid; generation pending; sample selected; coverage sufficient/biased; replacement requested/approved; version unlocked/locked; handoff"
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

