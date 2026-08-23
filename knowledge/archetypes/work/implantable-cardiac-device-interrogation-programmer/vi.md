# Implantable cardiac device interrogation programmer

## LOADS

None.

## Bản ghi

### Định danh

| Trường | Giá trị |
|---|---|
| Archetype ID | `implantable-cardiac-device-interrogation-programmer` |
| Family | Work |
| Dominant task | Interrogate thiết bị tim cấy ghép, nối battery/lead/episode với electrogram, sửa setting phụ thuộc, test và commit current-versus-proposed có trace. |
| Search aliases | implantable-cardiac-device-interrogation-programmer, cied-programmer, commit-and-exported-interrogation |
| Authority | Authority topology trang trung lập sản phẩm; archetype không chọn product semantics, visual direction, token, component, exact geometry hoặc breakpoint. |

### Bất biến

- `cied-programmer` sở hữu toàn bộ dominant task và recovery boundary.
- Mọi quan sát làm đổi quyết định giữ provenance tới đúng vùng đã tạo nó.
- Completion gate đánh giá mọi vùng bắt buộc chưa giải quyết trước khi đóng.
- Wide, intermediate và compact đổi topology khi một quan hệ được đặt tên thất bại.
- Transformation giữ selection, draft, pending work, recovery, reading order và ý nghĩa focus.

## Nhận diện

### Mã tình huống

| Mã | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-ICD-01` | Người dùng phải hoàn thành dominant task đã ghi trong Identity. | Bắt buộc dominant task. |
| `AR-ICD-02` | Mọi vùng trong graph đều thay đổi hoặc chứng minh quyết định kết thúc. | Bắt buộc graph đầy đủ và provenance. |
| `AR-ICD-03` | Quan hệ peer hoặc feedback phải đồng bộ khi evidence thay đổi. | Bắt buộc projection đồng bộ và invalidation. |
| `AR-ICD-04` | Work state có thể pending, unavailable, stale, conflict hoặc recoverable sau khi đã có input. | Bắt buộc state và recovery parity ở mọi topology. |
| `AR-ICD-90` | Một adjacent archetype trong hard rejection sở hữu task chính xác hơn. | Reject. |
| `AR-ICD-91` | Thiếu quan hệ domain, proof hoặc completion event bắt buộc. | Reject. |
| `AR-ICD-92` | Candidate chỉ đổi noun, density, color, component, card count hoặc state variation. | Reject dạng `duplicate-or-variation`. |

### Quy tắc chọn

Chọn `implantable-cardiac-device-interrogation-programmer` khi và chỉ khi có evidence cho `AR-ICD-01` đến `AR-ICD-04`, mọi vùng và quan hệ đều bắt buộc, đồng thời không có `AR-ICD-90` đến `AR-ICD-92`. Trả `needs-evidence` khi chưa chứng minh dominant task, completion owner, overflow owner hoặc recovery consequence.

## Đồ thị vùng

```text
├─ cied-programmer
├─ patient-device-lead-and-session-identity
├─ immutable-interrogation-snapshot
├─ battery-lead-sensing-pacing-and-episode-register
├─ selected-episode-event-markers-and-electrogram
├─ interdependent-mode-zone-and-therapy-program
├─ zone-mode-dependency-and-safety-checks
├─ proposed-versus-current-program
├─ mandatory-program-test-and-observation
└─ commit-and-exported-interrogation
```

Quan hệ bắt buộc: `cied-programmer → patient-device-lead-and-session-identity → immutable-interrogation-snapshot → battery-lead-sensing-pacing-and-episode-register → selected-episode-event-markers-and-electrogram ↔ interdependent-mode-zone-and-therapy-program → zone-mode-dependency-and-safety-checks → proposed-versus-current-program → mandatory-program-test-and-observation → commit-and-exported-interrogation`.

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ owner và quan hệ |
|---|---|
| `cied-programmer` | Sở hữu trạng thái và quyết định của `cied-programmer`; giữ quan hệ với hạ nguồn `patient-device-lead-and-session-identity` mà không hấp thụ owner của vùng khác. |
| `patient-device-lead-and-session-identity` | Sở hữu trạng thái và quyết định của `patient-device-lead-and-session-identity`; giữ quan hệ với thượng nguồn `cied-programmer` và hạ nguồn `immutable-interrogation-snapshot` mà không hấp thụ owner của vùng khác. |
| `immutable-interrogation-snapshot` | Sở hữu trạng thái và quyết định của `immutable-interrogation-snapshot`; giữ quan hệ với thượng nguồn `patient-device-lead-and-session-identity` và hạ nguồn `battery-lead-sensing-pacing-and-episode-register` mà không hấp thụ owner của vùng khác. |
| `battery-lead-sensing-pacing-and-episode-register` | Sở hữu trạng thái và quyết định của `battery-lead-sensing-pacing-and-episode-register`; giữ quan hệ với thượng nguồn `immutable-interrogation-snapshot` và hạ nguồn `selected-episode-event-markers-and-electrogram` mà không hấp thụ owner của vùng khác. |
| `selected-episode-event-markers-and-electrogram` | Sở hữu trạng thái và quyết định của `selected-episode-event-markers-and-electrogram`; giữ quan hệ với thượng nguồn `battery-lead-sensing-pacing-and-episode-register` và hạ nguồn `interdependent-mode-zone-and-therapy-program` mà không hấp thụ owner của vùng khác. |
| `interdependent-mode-zone-and-therapy-program` | Sở hữu trạng thái và quyết định của `interdependent-mode-zone-and-therapy-program`; giữ quan hệ với thượng nguồn `selected-episode-event-markers-and-electrogram` và hạ nguồn `zone-mode-dependency-and-safety-checks` mà không hấp thụ owner của vùng khác. |
| `zone-mode-dependency-and-safety-checks` | Sở hữu trạng thái và quyết định của `zone-mode-dependency-and-safety-checks`; giữ quan hệ với thượng nguồn `interdependent-mode-zone-and-therapy-program` và hạ nguồn `proposed-versus-current-program` mà không hấp thụ owner của vùng khác. |
| `proposed-versus-current-program` | Sở hữu trạng thái và quyết định của `proposed-versus-current-program`; giữ quan hệ với thượng nguồn `zone-mode-dependency-and-safety-checks` và hạ nguồn `mandatory-program-test-and-observation` mà không hấp thụ owner của vùng khác. |
| `mandatory-program-test-and-observation` | Sở hữu trạng thái và quyết định của `mandatory-program-test-and-observation`; giữ quan hệ với thượng nguồn `proposed-versus-current-program` và hạ nguồn `commit-and-exported-interrogation` mà không hấp thụ owner của vùng khác. |
| `commit-and-exported-interrogation` | Sở hữu trạng thái và quyết định của `commit-and-exported-interrogation`; giữ quan hệ với thượng nguồn `mandatory-program-test-and-observation` mà không hấp thụ owner của vùng khác. |

## Hợp đồng responsive

### Wide

- **Failure trigger:** Không còn đủ measure để đọc, thao tác và giữ focus không bị che cho các vùng cần so sánh đồng thời.
- **Topology response:** Giữ đồng thời toàn bộ completion-owning regions theo graph; chi tiết ràng buộc là: Device/lead snapshot, selected episode electrogram, programmable settings, dependency warnings, current/proposed diff and test evidence remain simultaneously visible
- **Navigation replacement:** Không thay navigation khi các quan hệ quyết định vẫn được cảm nhận trực tiếp.
- **Sticky boundary:** Chỉ identity hiện tại hoặc completion gate được persist sau khi reserve space; short height trả nó về normal flow.
- **Overflow owner:** Chỉ `immutable-interrogation-snapshot` được sở hữu bounded overflow cần thiết cho task.

### Intermediate

- **Failure trigger:** Vùng hỗ trợ ưu tiên thấp nhất không thể persist mà không nén active relationship hoặc che focus.
- **Topology response:** Giữ primary relationship và chuyển support thấp nhất sang synchronized temporary route; chi tiết ràng buộc là: Selected episode or setting group and current/proposed diff remain primary; battery/lead overview becomes a persistent summary rail and detailed test history moves to a drawer
- **Navigation replacement:** Route có label mở đúng vùng hỗ trợ rồi trả query, selection, draft, scroll và trigger focus.
- **Sticky boundary:** Identity hiện tại có thể persist; support tạm và actions nằm trong normal flow.
- **Overflow owner:** `immutable-interrogation-snapshot` giữ bounded overflow khi detail hỗ trợ chuyển sang resumable view.

### Compact

- **Failure trigger:** Side-by-side không còn giữ readable measure, target size hoặc quan hệ được đặt tên.
- **Topology response:** Chuyển thành một primary stage theo semantic order; chi tiết ràng buộc là: Verify patient/device/leads → freeze and review the interrogation snapshot → inspect one episode through event markers plus an electrogram table alternative → edit one mode/zone/therapy dependency group → resolve safety conflicts → compare current/proposed → run the mandatory test and record observation → commit/export; the dashboard yields to a session sequence, and commit remains unreachable from editing or comparison until test evidence passes
- **Navigation replacement:** Sequence có label thay simultaneous panes và cung cấp direct bounded review route.
- **Sticky boundary:** Chỉ compact orientation được persist sau khi reserve space; primary action vẫn reachable trong flow.
- **Overflow owner:** `immutable-interrogation-snapshot` dùng semantic alternative bounded; page không sở hữu horizontal scroll.

### Reflow

- DOM order, reading order và meaningful focus order là `cied-programmer → patient-device-lead-and-session-identity → immutable-interrogation-snapshot → battery-lead-sensing-pacing-and-episode-register → selected-episode-event-markers-and-electrogram → interdependent-mode-zone-and-therapy-program → zone-mode-dependency-and-safety-checks → proposed-versus-current-program → mandatory-program-test-and-observation → commit-and-exported-interrogation`.
- CSS không reorder semantics.
- Label dài, bản dịch, zoom 400% và text phóng to wrap mà không mất action hoặc state meaning.
- Temporary view focus heading của nó và trả về đúng trigger cùng selection và draft.

### Interaction parity

- Pointer, keyboard và assistive technology truy cập mọi core action.
- Drag, spatial, chart, image, curve, graph hoặc map luôn có semantic button, list, coordinate hoặc table alternative.
- Topology change không reset work state hoặc duplicate pending action.
- Dynamic status dùng text và semantics ngoài color rồi announce mà không cướp focus.
- Validation giữ input, có inline error, focus summary khi nhiều lỗi và cung cấp recovery cụ thể.
- Task parity gồm device identity matched/mismatch, interrogation connecting/complete/interrupted/stale, battery normal/advisory/critical, lead measure stable/out-of-range/unavailable, episode unreviewed/classified, electrogram loading/error, setting valid/conflicting/out-of-range, safety check pending/pass/fail, proposal dirty/reverted, test running/aborted/observed, commit pending/success/failure/rollback and export available/failed.

## Nghĩa vụ trạng thái

Task-specific states: device identity matched/mismatch, interrogation connecting/complete/interrupted/stale, battery normal/advisory/critical, lead measure stable/out-of-range/unavailable, episode unreviewed/classified, electrogram loading/error, setting valid/conflicting/out-of-range, safety check pending/pass/fail, proposal dirty/reverted, test running/aborted/observed, commit pending/success/failure/rollback and export available/failed.

| State family | Hành vi bắt buộc |
|---|---|
| Initial / loading | Nêu scope đang tải, reserve primary region và chỉ block vùng thất bại. |
| Ready | Thể hiện current object, owner relationship và valid actions bằng text cùng semantics. |
| Empty / not-applicable | Phân biệt true empty, no-match và non-applicable, kèm next action hợp lệ. |
| Error / retry | Nêu scope lỗi, giữ input/work state và cung cấp target retry hoặc correction. |
| Permission / unavailable | Giải thích restriction bằng text; read-only khác disabled và vẫn giữ context. |
| Pending | Ngăn duplicate, giữ context, cho cancel khi an toàn và announce progress. |
| Success | Xác nhận chính xác scope đã đổi, cập nhật dependent summaries và giữ next valid step. |
| Stale / conflict | So local với external state, không silent overwrite và giữ deterministic recovery. |
| Focus transition | Stage change do user kích hoạt focus heading mới; status-only update không chuyển focus. |
| Responsive presentation | Wide giữ simultaneity; intermediate làm support thấp tạm thời; compact dùng một primary stage có parity. |

## Ranh giới

### Chấp nhận

- Template phải chứng minh chuỗi task-specific trong acceptance focus bằng fictional data, keyboard-complete action và recovery không mất state.
- Chỉ accept variation khi dominant task, required regions, relationships, transformations và completion event không đổi.

### Từ chối

- Reject mọi adjacent archetype được nêu trong hard rejection khi nó thiếu graph hoặc completion-owning relationship của leaf này.
- Reject khi adjacent archetype sở hữu work object hoặc completion event chính xác hơn.

### Phán quyết ranh giới

Trả `accept` chỉ khi selection rule pass. Trả `reject` cho `AR-ICD-90`, `AR-ICD-91` hoặc `AR-ICD-92`. Trả `needs-evidence` khi business truth chưa chứng minh dominant task, relationship, overflow owner hoặc completion consequence.

## Handoff

1. Business truth cung cấp actor, object, rule, permission, state transition và completion consequence.
2. Archetype này giải dominant task, region graph, responsive replacement, semantic order và parity.
3. Grammar gắn product-semantic owner vào region và state mà không đổi topology.
4. Principles giải exact grid, measure, gap, size, alignment, overflow và content-fit threshold.
5. Direction thể hiện visual character bên trong owner đã accept.

## Bằng chứng nghiên cứu không ràng buộc

### Ranh giới bằng chứng

Research dưới đây là advisory evidence, không phải product truth. Nó không cấp quyền copy geometry, component tree, product noun, breakpoint hoặc visual treatment; mọi binding claim vẫn đi qua business truth, Grammar và Principles.

### Nguồn

| Source | Hỗ trợ điều gì | Không chứng minh điều gì |
|---|---|---|
| [IHE Patient Care Device technical framework](https://profiles.ihe.net/DEV/index.html) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [2019 HRS/EHRA/APHRS/LAHRS focused update on ICD programming and testing](https://www.hrsonline.org/resource/2019-hrsehraaphrslahrs-focused-update-2015-expert-consensus-statement-optimal-implantable/) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [2023 HRS/EHRA/APHRS/LAHRS consensus on practical management of the remote device clinic](https://www.hrsonline.org/resource/2023-hrsehraaphrslahrs-expert-consensus-statement-practical-management-remote-device-clinic/) | Hỗ trợ task-domain workflow and evidence obligations. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Hỗ trợ non-disruptive status announcements. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Focus order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Hỗ trợ semantic and focus order. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Hỗ trợ reflow and bounded two-dimensional exceptions. | Không chứng minh product truth, exact geometry, breakpoint, component hoặc visual direction. |

## Đầu ra

```json
{
  "archetypeId": "implantable-cardiac-device-interrogation-programmer",
  "matchedSituationCodes": [
    "AR-ICD-01",
    "AR-ICD-02",
    "AR-ICD-03",
    "AR-ICD-04"
  ],
  "aliases": [
    "implantable-cardiac-device-interrogation-programmer",
    "cied-programmer",
    "commit-and-exported-interrogation"
  ],
  "dominantTask": "Interrogate an implanted cardiac device, correlate battery/lead measurements and detected episodes with electrograms, edit interdependent pacing or therapy-zone settings, run safety and observation checks, and commit a traceable current-versus-proposed program",
  "regions": [
    "cied-programmer",
    "patient-device-lead-and-session-identity",
    "immutable-interrogation-snapshot",
    "battery-lead-sensing-pacing-and-episode-register",
    "selected-episode-event-markers-and-electrogram",
    "interdependent-mode-zone-and-therapy-program",
    "zone-mode-dependency-and-safety-checks",
    "proposed-versus-current-program",
    "mandatory-program-test-and-observation",
    "commit-and-exported-interrogation"
  ],
  "relationships": [
    "cied-programmer → patient-device-lead-and-session-identity → immutable-interrogation-snapshot → battery-lead-sensing-pacing-and-episode-register → selected-episode-event-markers-and-electrogram ↔ interdependent-mode-zone-and-therapy-program → zone-mode-dependency-and-safety-checks → proposed-versus-current-program → mandatory-program-test-and-observation → commit-and-exported-interrogation"
  ],
  "responsive": {
    "wide": "Device/lead snapshot, selected episode electrogram, programmable settings, dependency warnings, current/proposed diff and test evidence remain simultaneously visible",
    "intermediate": "Selected episode or setting group and current/proposed diff remain primary; battery/lead overview becomes a persistent summary rail and detailed test history moves to a drawer",
    "compact": "Verify patient/device/leads → freeze and review the interrogation snapshot → inspect one episode through event markers plus an electrogram table alternative → edit one mode/zone/therapy dependency group → resolve safety conflicts → compare current/proposed → run the mandatory test and record observation → commit/export; the dashboard yields to a session sequence, and commit remains unreachable from editing or comparison until test evidence passes",
    "reflow": "DOM order remains semantic order; supporting regions become synchronized temporary routes without resetting work.",
    "readingOrder": "cied-programmer → patient-device-lead-and-session-identity → immutable-interrogation-snapshot → battery-lead-sensing-pacing-and-episode-register → selected-episode-event-markers-and-electrogram → interdependent-mode-zone-and-therapy-program → zone-mode-dependency-and-safety-checks → proposed-versus-current-program → mandatory-program-test-and-observation → commit-and-exported-interrogation",
    "navigationReplacement": "Intermediate uses labeled synchronized support routes; compact uses a labeled one-primary-stage sequence.",
    "stickyBehavior": "Only identity or the active completion gate may persist after reserving space, and it yields at short height.",
    "overflowOwner": "immutable-interrogation-snapshot",
    "interactionParity": "Every action, state, error recovery, selection, and focus-return target remains available in every topology."
  },
  "stateObligations": [
    "device identity matched/mismatch",
    "interrogation connecting/complete/interrupted/stale",
    "battery normal/advisory/critical",
    "lead measure stable/out-of-range/unavailable",
    "episode unreviewed/classified",
    "electrogram loading/error",
    "setting valid/conflicting/out-of-range",
    "safety check pending/pass/fail",
    "proposal dirty/reverted",
    "test running/aborted/observed",
    "commit pending/success/failure/rollback and export available/failed"
  ],
  "boundaryVerdict": "needs-evidence",
  "grammarHandoff": [
    "product facts",
    "semantic owners",
    "permissions",
    "consequences"
  ],
  "principlesHandoff": [
    "exact grid",
    "measure",
    "gap",
    "size",
    "alignment",
    "overflow",
    "content-fit thresholds"
  ],
  "confidence": "high when all positive situations and the completion-owning relationship are evidenced; otherwise needs-evidence",
  "evidenceClasses": [
    "business or current-source evidence",
    "official task-domain guidance",
    "official accessibility guidance"
  ]
}
```

Không trả class, token, component, source path, fixed breakpoint hoặc invented product fact.
