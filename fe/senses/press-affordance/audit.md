---
id: fe-senses-press-affordance-audit
title: audit.md
slug: /fe/senses/press-affordance/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện AI cho press affordance và coverage tương tác.
---

# audit.md

> Version được audit: `1.02` · Trạng thái: **Advisory** · Người quyết định cuối: **Canon owner** · Lịch sử nội bộ: `changelog.md`

## Kết luận nhanh

| Phần | Đánh giá | Nhận định |
|---|---|---|
| `INDEX.md` | Tốt | Giữ đủ sáu ruling gốc và thêm decision procedure đa input mode |
| `vi.md` | Tốt, chi tiết | Hover, press, focus, touch, nested control, states và drag có boundary rõ |
| `example.md` | Bao phủ rộng, cần interaction QA | Mười một demo IDs; screenshot tĩnh không đủ duyệt |
| Axis placement | Đúng | Đây là design judgement về target claim và feedback, không phải vendor spelling |
| Live UI | Đã integration | Mười một HeroUI interaction demos có hover/press/focus/touch/nested/state/drag behavior; build/route đạt |

## Source law được giữ

- One gesture gets one answer.
- Destination-naming line uses the ordinary link mark.
- Nested control is not part of the outer press target.
- Press responds before slow route completion.
- Affordance belongs to activation owner, not arrangement.
- Pointer affordance requires keyboard and accessible-name parity.

Version `1.01` không đổi nghĩa sáu ruling này. Touch discovery, state separation, drag threshold và
reduced-motion guidance được thêm để vét các input mode source chưa mô tả đủ; chúng không tự tạo
vendor requirement.

## Coverage của live demo

| Demo ID | Input mode | Proof cần có |
|---|---|---|
| `press-naming-line` | Pointer | Một answer, ordinary link mark |
| `press-surface-answer` | Pointer | Không underline status giả |
| `press-immediate-feedback` | Pointer/touch | `pointerdown`/press trước navigation |
| `press-keyboard-focus` | Keyboard | Focus visible, role, accessible name, activation |
| `press-touch-discovery` | Touch | Cue tồn tại không cần hover |
| `press-nested-link` | Pointer/keyboard | Outer visual và activation cùng dừng |
| `press-nested-button` | Pointer/keyboard | Button state riêng, không navigate |
| `press-handler-ownership` | All | Handler absent thì affordance absent |
| `press-selected-vs-hover` | Pointer/state | Transient và persistent state khác nhau |
| `press-drag-threshold` | Pointer/touch | Drag hủy press |
| `press-reduced-motion` | Preference | Feedback còn, motion không bắt buộc |

## Điểm mở

| ID | Finding | Ưu tiên | Disposition |
|---|---|---:|---|
| PRESS-A01 | Exact ordinary link underline chưa được machine-resolved trong module design | P1 | Dùng product link owner; không invent token |
| PRESS-A02 | Touch cue có thể bị lạm dụng thành decorative chevron | P1 | Chỉ chấp nhận khi cue nói navigation thật |
| PRESS-A03 | Nested suppression cần test cả pointer, focus-within và activation propagation | P0 | Owner được tách thành Link/Button siblings; chờ browser QA |
| PRESS-A04 | Native element/role/Space behavior phụ thuộc control primitive | P1 | Chờ implementation evidence |
| PRESS-A05 | Drag threshold chưa có một value universal; không được đặt measurement trong design law | P1 | Chỉ giữ semantic requirement |
| PRESS-A06 | Reduced-motion demo cần kiểm stylesheet/theme thật | P2 | Chờ registry implementation |

## Guardrail cho publication

Một Card hiển thị đẹp ở resting state không chứng minh module này. Live demo chỉ đạt khi người review
có thể:

1. hover đúng outer và inner target;
2. pointer-down để thấy immediate answer;
3. tab qua từng control và kích bằng keyboard;
4. quan sát outer answer bị suppress;
5. thử trạng thái handler absent/disabled;
6. xem touch cue mà không cần hover.

Code tab phải tương ứng với đúng behavior đang render, không dùng một snippet minh họa khác.

## Khi nào re-audit?

- Link system đổi underline treatment.
- Pressable surface primitive hoặc nested-control convention đổi.
- Router/navigation pending behavior đổi.
- Touch, keyboard hoặc reduced-motion test tìm thấy parity gap.
- Live demo registry được triển khai hoặc thay API.

## Publication audit `1.02`

- `INTERACTION_EXAMPLES` cung cấp đủ mười một press IDs với shape `{render, title, code}`.
- Demo dùng HeroUI Link/Button/Card thật cho naming-line, surface answer, immediate feedback, keyboard
  destination, touch cue, nested link/button, handler ownership và current state.
- Drag và reduced-motion demos có state riêng; không đặt universal pixel threshold hoặc custom motion
  requirement vào law.
- Nested interactions dùng main Link và secondary Link/Button là sibling owners trong Card, tránh
  HTML interactive nesting sai ngay từ cấu trúc demo.
- JSX parse, esbuild bundle, shared-registry merge và full Nextra build đã đạt; pointer/focus/touch QA sâu vẫn mở.
