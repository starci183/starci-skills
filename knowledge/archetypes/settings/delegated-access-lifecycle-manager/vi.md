# Bộ quản lý vòng đời delegated access

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | delegated-access-lifecycle-manager |
| Family | settings |
| Dominant task | Quản lý delegate từ authority evidence qua invitation, scoped grant, expiry, effective-access review, renewal và revocation. |
| Search aliases | delegated-access-lifecycle-manager; delegate access; access lifecycle; authority invitation expiry |
| Authority | Dominant-task topology, region graph, responsive transformation, interaction parity và state families. |

### Bất biến

- Quản lý delegate từ authority evidence qua invitation, scoped grant, expiry, effective-access review, renewal và revocation.
- Mỗi required region có một semantic owner; supporting context không lấy dominant task.
- DOM order, reading order và focus order giữ nguyên meaning qua wide, intermediate và compact.
- Grammar cung cấp product facts; Principles resolve exact geometry; archetype không sở hữu visual direction.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| AR-DAL-01 | Quản lý delegate từ authority evidence qua invitation, scoped grant, expiry, effective-access review, renewal và revocation. | required positive evidence |
| AR-DAL-02 | Critical region relationship và owner separation đều có bằng chứng. | required relationship evidence |
| AR-DAL-03 | Wide relationship không còn hoạt động nhưng compact vẫn giữ task, state và recovery. | responsive transformation trigger |
| AR-DAL-04 | Error, permission, pending, success và stale/conflict đều có bounded recovery. | required state evidence |
| AR-DAL-90 | Reject permission matrix, one-time third-party grant, account switcher và preference center. | reject |
| AR-DAL-91 | Khác biệt chỉ là product noun, density, color, component, state skin hoặc card count. | duplicate-or-variation |

### Quy tắc chọn

Chỉ trả accept khi AR-DAL-01, AR-DAL-02 và AR-DAL-03 có bằng chứng, không có AR-DAL-90 hoặc AR-DAL-91, và mọi required region vẫn cần thiết ở cả ba topology. Trả needs-evidence khi owner, relation hoặc transformation chưa resolve.

## Region graph

~~~text
delegation-manager
├─ account-subject
├─ delegate-roster
├─ authority-evidence
├─ scoped-access-bundles
├─ invitation-verification-expiry
├─ effective-access-activity
└─ renew-revoke-recovery
~~~

Critical relationship: Authority proof và lifecycle state phân biệt delegate với permission cell; effective access được suy ra từ grant đã verify và chưa expiry.

### Nghĩa vụ vùng

| Region ID | Owner | Required relationship |
|---|---|---|
| delegation-manager | Sở hữu boundary của dominant task và chứa mọi required region mà không tạo product semantics. | Chứa account-subject, delegate-roster, authority-evidence, scoped-access-bundles, invitation-verification-expiry, effective-access-activity, renew-revoke-recovery và giữ owner độc lập của từng region. |
| account-subject | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ delegation-manager và gates delegate-roster mà không gộp authority. |
| delegate-roster | Sở hữu membership, identity, status và current selection của collection hữu hạn này. | Nhận context từ account-subject và gates authority-evidence mà không gộp authority. |
| authority-evidence | Sở hữu source evidence, provenance, freshness và availability; không tự quyết định outcome. | Nhận context từ delegate-roster và gates scoped-access-bundles mà không gộp authority. |
| scoped-access-bundles | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ authority-evidence và gates invitation-verification-expiry mà không gộp authority. |
| invitation-verification-expiry | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận context từ scoped-access-bundles và gates effective-access-activity mà không gộp authority. |
| effective-access-activity | Sở hữu derived interpretation hoặc consequence preview; không trở thành input authority thứ hai. | Nhận context từ invitation-verification-expiry và gates renew-revoke-recovery mà không gộp authority. |
| renew-revoke-recovery | Sở hữu state và obligation của stage được đặt tên; không lấy authority của region lân cận. | Nhận verified state từ effective-access-activity và phát outcome hoặc recovery hữu hạn. |

## Responsive contract

### Wide

- Topology response: Keep delegate roster, selected authority and grant, invitation lifecycle, and effective-access activity simultaneously visible.
- Failure trigger: simultaneous regions làm hẹp readable measure, che state hoặc phá named relationship.
- Navigation replacement: chưa cần khi các vùng còn đồng hiện; sticky chỉ dành cho orientation context vừa viewport.
- Sticky boundary: tự yield ở short-height và không che focused control.
- Overflow owner: page own vertical overflow; chỉ intrinsic matrix mới own bounded horizontal overflow.

### Intermediate

- Topology response: Keep delegate selection and lifecycle detail primary; move supporting authority evidence to a drawer.
- Failure trigger: supporting persistence cạnh tranh primary-task measure hoặc focus.
- Navigation replacement: named trigger mở supporting dialog; Escape hoặc Cancel đóng và focus trở đúng trigger.
- Sticky boundary: persistent context tự yield ở short-height; dialog body own bounded vertical overflow.
- Overflow owner: page giữ vertical overflow; supporting dialog chỉ own overflow bên trong boundary của nó.

### Compact

- Topology response: Stage delegate identity and authority, grant, invitation and verification, effective access, then renewal or revocation.
- Failure trigger: multi-pane relation không còn operable với body text 16px và target 44px.
- Navigation replacement: Previous, Next và stage selector thay pane adjacency; Back giữ selection, draft và recovery state.
- Sticky boundary: không fixed action bar; focused content luôn visible.
- Overflow owner: không page-level horizontal scroll; intrinsic matrix trở thành grouped records.

### Reflow

Thứ tự region graph là DOM order và reading order ở mọi width. CSS không reorder semantics. Text, localization, zoom và spacing growth làm region cao hơn hoặc trigger topology change; content không bị clip. State sống qua việc region đi vào hoặc ra supporting pane.

### Tương đương tương tác

Wide, intermediate và compact cung cấp cùng action, selection, pending guard, success, error, retry, stale/conflict recovery và outcome. Dynamic status được announce bằng polite live region mà không cướp focus. Modal giữ focus, hỗ trợ Escape hoặc Cancel và trả focus đúng trigger.

## Nghĩa vụ trạng thái

Domain state catalog giữ stable identifiers để EN/VI/context đồng bộ: delegate invited/verified/expired/suspended; authority evidence valid/missing; grant draft/active; invitation delivery failure; activity unavailable; renewal pending; revoke pending/success; recovery.

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
| domain states | Giữ đầy đủ state identifiers: delegate invited/verified/expired/suspended; authority evidence valid/missing; grant draft/active; invitation delivery failure; activity unavailable; renewal pending; revoke pending/success; recovery. | Mọi modal trả focus đúng trigger. | Giữ action và recovery parity. |

## Ranh giới

### Chấp nhận

Accept khi dominant task cần chính region graph này, critical relationship tạo topology riêng, và mọi responsive state giữ task cùng recovery parity.

### Từ chối

Reject permission matrix, one-time third-party grant, account switcher và preference center. Cũng reject duplicate-or-variation khi candidate chỉ đổi noun, density, component hoặc visual state.

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
| [Microsoft Entra — Create an access package](https://learn.microsoft.com/en-us/entra/id-governance/entitlement-management-access-package-create) | Hỗ trợ scoped entitlement packages and reviewable policy. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [NIST — Federation and assertions](https://pages.nist.gov/800-63-4/sp800-63c.html) | Hỗ trợ verified federated identity and assertion boundaries. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |
| [W3C WAI — Accessible Authentication](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum) | Hỗ trợ authentication without unnecessary cognitive barriers. | Không chứng minh product facts, geometry, breakpoint hoặc visual direction. |

## Output

~~~json
{
  "archetypeId": "delegated-access-lifecycle-manager",
  "matchedSituationCodes": [
    "AR-DAL-01",
    "AR-DAL-02",
    "AR-DAL-03"
  ],
  "aliases": [
    "delegated-access-lifecycle-manager",
    "delegate access",
    "access lifecycle",
    "authority invitation expiry"
  ],
  "dominantTask": "Manage a delegate from authority evidence through invitation, scoped grant, expiry, effective-access review, renewal, and revocation.",
  "regions": [
    "delegation-manager",
    "account-subject",
    "delegate-roster",
    "authority-evidence",
    "scoped-access-bundles",
    "invitation-verification-expiry",
    "effective-access-activity",
    "renew-revoke-recovery"
  ],
  "relationships": [
    "Authority proof and lifecycle state distinguish a delegate from a permission cell; effective access derives from verified, unexpired grants."
  ],
  "responsive": {
    "wide": "Keep delegate roster, selected authority and grant, invitation lifecycle, and effective-access activity simultaneously visible.",
    "intermediate": "Keep delegate selection and lifecycle detail primary; move supporting authority evidence to a drawer.",
    "compact": "Stage delegate identity and authority, grant, invitation and verification, effective access, then renewal or revocation.",
    "reflow": "DOM and reading order remain stable; content grows without page-level horizontal scrolling.",
    "readingOrder": "delegation-manager → account-subject → delegate-roster → authority-evidence → scoped-access-bundles → invitation-verification-expiry → effective-access-activity → renew-revoke-recovery",
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
    "delegate invited/verified/expired/suspended; authority evidence valid/missing; grant draft/active; invitation delivery failure; activity unavailable; renewal pending; revoke pending/success; recovery"
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

