---
id: fe-senses-restraint-audit
title: audit.md
slug: /fe/senses/restraint/audit
sidebar_label: audit.md
sidebar_position: 3
description: AI audit advisory and evidence boundary for the Restraint module.
---

# audit.md

> Version: `1.02` · Module: `restraint` · Canon: [`INDEX.md`](./INDEX.md) · Lịch sử: `changelog.md`

## Evidence boundary

Evidence của module này **yếu đến trung bình**. “Restraint” không có một source law độc lập đủ sâu;
nó được tạo như preflight gate từ ba luật đã có evidence rõ hơn: hierarchy/emphasis budget,
surface/boundary membership và CTA/one ask.

Vì vậy canon chỉ được phép:

- inventory emphasis, edge, control;
- buộc mỗi candidate gọi tên observable job;
- remove/demote candidate không có job hoặc duplicate;
- route candidate hợp lệ sang owner module;
- bảo vệ meaning/accessibility/recovery/path onward khỏi minimalism mù quáng.

Nó không được tự định nghĩa style, density, số component, “clean UI”, minimalism hay product taste.

## Đánh giá hiện tại

| Phần | Trạng thái | Nhận xét |
|---|---|---|
| `INDEX.md` | Tốt trong boundary | Một gate + vocabulary + routing, không lặp owner rules |
| `vi.md` | Tốt | Phân biệt justified presence với xóa content cần thiết |
| `example.md` | Tốt, renderer đã sẵn sàng | 8 scenario course/review có before/after và UI/Code definitions riêng |
| HeroUI authenticity | Tốt | Card, Button, Avatar, Chip, Separator, Skeleton được render trực tiếp |
| Standalone design law | Cố ý không claim | Evidence chưa đủ để nói restraint là một aesthetic system |
| Accessibility guard | Tốt ở mức nguyên tắc | Focus/state/recovery/path onward không được xóa vì “quiet” |

## WATCHED ambiguities

| ID | Ambiguity | Rủi ro | Trạng thái |
|---|---|---:|---|
| RES-W01 | “Observable job” vẫn có thể được viết rất mơ hồ | P1 | WATCHED — từ chối adjective, yêu cầu reader/state outcome |
| RES-W02 | Hai candidates có thể share job nhưng bổ sung channel/accessibility | P1 | WATCHED — không dedupe nếu một channel cần cho non-visual use |
| RES-W03 | Content detail dễ bị gọi nhầm là clutter | P1 | WATCHED — chỉ remove unearned presentation, giữ decision evidence |
| RES-W04 | Edge đôi khi mang hit/clipping/selection job ngoài membership | P1 | WATCHED — route đầy đủ sang surface/component evidence |
| RES-W05 | Utility hiếm dùng vẫn có job hợp lệ | P2 | WATCHED — demote/disclose, không mặc định remove |
| RES-W06 | State cue duplication có thể cần multi-channel communication | P1 | WATCHED — error copy + focus + live announcement có thể cùng cần |
| RES-W07 | Responsive furniture đôi khi là alternate access path | P2 | WATCHED — kiểm task equivalence trước khi loại |

## Không được suy rộng

- Không đặt giới hạn “mỗi card tối đa N controls/edges/colours”.
- Không coi whitespace, monochrome hay ít button là mặc định tốt.
- Không xóa focus ring, label, helper, status, recovery hoặc error copy để giảm visual noise.
- Không dùng restraint thay hierarchy/surface/CTA review.
- Không kết luận detailed curriculum/reviews là thừa nếu người đọc cần chúng để quyết định.
- Không biến “one job” thành “one visual channel”; accessibility có thể cần nhiều channel phối hợp.

## Audit live examples

| ID | Evidence UI phải có | Failure cần tránh |
|---|---|---|
| `restraint-course-overview` | Instructor, counts, progress, next lesson, action/path | Empty minimal card |
| `restraint-student-reviews` | Aggregate + review evidence thật | Chỉ 4,9 và title |
| `restraint-edge-gate` | Section/peer surface relationship | Border comparison vô nghĩa |
| `restraint-control-gate` | Primary, secondary path, contextual utility | Nhiều equal primary actions |
| `restraint-emphasis-gate` | Lead/support/state nhìn ra được | Mọi fact cùng accent |
| `restraint-review-actions` | Permission/context-specific menus | Universal 8-action menu |
| `restraint-state-cues` | Loading/empty/error đủ meaning/recovery | Quiet state mất recovery |
| `restraint-responsive-furniture` | Rail có navigation job + mobile alternate path | Side card lấp whitespace |

## Audit renderer `1.02`

- `foundation.js` export đủ 8 restraint definitions theo shape `{render,title,code}`.
- Mọi demo dùng so sánh trước/sau: bản sau giảm emphasis/edge/control duplicate nhưng không xóa
  instructor, module/bài/thời lượng/progress, rating/count/recommendation, avatar/cohort/comment.
- Control gate giữ primary, detail path và accessible contextual utility; review action gate giữ menu
  label/role theo permission thay vì universal action wall.
- State gate giữ error name, course context, `Thử lại` recovery và path quay lại; note xác nhận focus/live
  announcement không được loại chỉ vì visual quiet.
- Responsive gate giữ course navigation job và mobile disclosure; chỉ bỏ filler furniture.
- SWC parse, shared-registry import, production build và route sweep đã đạt; subtraction judgment vẫn
  phải kiểm theo task context để không xóa evidence hoặc recovery.

## Code-tab parity finalization `1.02`

- Cả 8 foundation code strings dùng JSX HeroUI/HTML concrete, không còn pseudo summary/menu/state tags.
- Subtraction code vẫn giữ course/review evidence, accessible labels/roles, semantic error text,
  `Thử lại` recovery và path onward; chỉ bỏ candidate duplicate/unearned.
- Scan xác nhận không literal ellipsis và không PascalCase tag ngoài HeroUI allowlist.
- Đây là QA finalization cùng release `1.02`; restraint gate/WATCHED dispositions không đổi.

## Khi nào re-audit?

- Có source evidence độc lập cho restraint beyond routing gate.
- Một candidate bị xóa làm mất discoverability, semantic state hoặc accessibility.
- “Observable job” không giúp hai reviewer đi đến cùng disposition.
- Owner modules thay đổi vocabulary/decision procedure.
- Một WATCHED ambiguity được canon owner disposition; accepted change phải tăng version.
