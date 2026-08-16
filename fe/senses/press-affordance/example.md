---
id: fe-senses-press-affordance-example
title: example.md
slug: /fe/senses/press-affordance/example
sidebar_label: example.md
sidebar_position: 2
description: Tình huống hover, press, focus, touch và nested control, kèm live UI/Code.
---

# example.md

> Version: `1.02` · Module: `press-affordance` · Hướng dẫn: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mỗi demo phải thử bằng pointer, keyboard và touch-equivalent reasoning. Resting screenshot không đủ
chứng minh affordance.

## Nhìn nhanh

| Tình huống | When | Not when |
|---|---|---|
| Row có destination title | Title dùng ordinary link mark | Title underline và row dim cùng lúc |
| Tile không naming line | Surface trả lời restrained | Underline một caption không phải destination |
| Pointer down | Feedback ngay | Im lặng tới khi route xong |
| Keyboard | Focus rõ, Enter/Space đúng role | Chỉ hover/click hoạt động |
| Touch | Có cue persistent/convention | Action chỉ xuất hiện on hover |
| Nested link/button | Outer answer và activation dừng | Hai destination cùng trả lời |
| Handler absent | Cursor/hover cũng absent | Dead row vẫn trông clickable |
| Drag + press | Movement hủy activation | Drop vô tình navigate |

## Naming line trả lời hover

**When:** Course row mở “System Design Mastery”. Chính title đó underline bằng ordinary link mark;
row không dim.

**Not when:** Title underline đồng thời cả row đổi background, tạo hai target claims cho một hover.

<CodeUiTabs example="press-naming-line" />

## Surface trả lời khi không có naming line

**When:** Visual project tile gồm thumbnail, progress và collaborator avatars; không có một line duy
nhất là destination name, nên toàn tile dùng một restrained surface answer.

**Not when:** Underline “Đang tiến hành” dù đó chỉ là status, khiến status trông như link sẽ mở.

<CodeUiTabs example="press-surface-answer" />

## Press feedback trước slow route

**When:** Pointer down làm row nhận pressed state ngay; navigation progress tiếp nối nếu course page
cần tải.

**Not when:** Click không tạo phản hồi trong một giây, người dùng bấm hai lần.

<CodeUiTabs example="press-immediate-feedback" />

## Focus là affordance thật, không phải bản sao mờ của hover

**When:** Tab tới row làm focus ring hiện rõ; Enter mở cùng course với click. Accessible name là “Mở
System Design Mastery”.

**Not when:** Row chỉ có `cursor: pointer`; tab bỏ qua hoặc focus vào wrapper không kích hoạt được.

<CodeUiTabs example="press-keyboard-focus" />

## Touch discovery không chờ hover

**When:** Mobile course row dùng layout convention ổn định và chevron thật sự báo navigation. Toàn
row có hit target, nested bookmark vẫn riêng.

**Not when:** Chỉ khi hover mới underline title; trên touch row trông như static content.

<CodeUiTabs example="press-touch-discovery" />

## Nested link sở hữu gesture của nó

**When:** Pointer/focus trên “Vì sao giá này?” chỉ underline link đó. Outer course title và surface
ngừng trả lời; activation mở price explanation.

**Not when:** Inner link và outer title cùng underline, dù click cuối cùng chỉ mở inner destination.

<CodeUiTabs example="press-nested-link" />

## Nested button không navigate outer row

**When:** Bookmark button có focus, pressed và selected state riêng. Click/Space lưu khóa học, không
mở detail; outer answer bị suppress trong hit area của button.

**Not when:** Bookmark dừng click propagation nhưng outer row vẫn dim/title vẫn underline.

<CodeUiTabs example="press-nested-button" />

## Handler và affordance cùng biến mất

**When:** Archived item không còn route thì render như information row, không pointer cursor, hover
answer hoặc fake focus.

**Not when:** Layout class vẫn làm row sáng khi hover dù activation prop không được truyền.

<CodeUiTabs example="press-handler-ownership" />

## Selected không phải hover

**When:** Inbox row current conversation có persistent selected/current state; hover chỉ thêm một
transient cue trên row khác.

**Not when:** Hover và selected dùng cùng meaning, khiến người dùng không biết conversation nào đang
mở sau khi pointer rời đi.

<CodeUiTabs example="press-selected-vs-hover" />

## Drag không kết thúc bằng navigation

**When:** Project card bắt đầu drag sau movement threshold; vượt threshold hủy pending press. Click
không di chuyển vẫn mở detail.

**Not when:** Thả card sau khi reorder đồng thời navigate sang project.

<CodeUiTabs example="press-drag-threshold" />

## Reduced motion vẫn có feedback

**When:** Pressed state đổi trực tiếp bằng tone/opacity có contrast đủ, không phụ thuộc animation.

**Not when:** Tắt animation cũng xóa luôn mọi phản hồi cho press.

<CodeUiTabs example="press-reduced-motion" />

## Ma trận tình huống mở rộng

| Context | Press owner | Nested owner | Answer đúng |
|---|---|---|---|
| Course list | Row mở course | Bookmark button | Title underline; bookmark suppress outer |
| Search result | Result link | Author link | Destination title hoặc inner author, không cả hai |
| Notification | Row mở event | Overflow menu | Naming line answer; menu riêng |
| Pricing | Plan card chọn plan | “Chi tiết phí” link | Surface/selection answer và inner link tách |
| Inbox | Conversation row | Checkbox | Hover khác current; checkbox không navigate |
| Dashboard tile | Tile mở report | Download button | Surface answer; download riêng |
| File browser | Row mở file | Context menu | Filename answer; menu suppress outer |
| Mobile settings | Row navigate | Switch | Persistent navigation cue; switch riêng |
| Kanban | Card detail + drag | Assignee link | Threshold tách drag/press; link riêng |
| Disabled archive | Không có route | None | Không affordance claim |
| Slow analytics | Card mở report | None | Press feedback rồi progress |
| Keyboard list | Row action | Secondary link | Focus owner rõ theo từng stop |

## Checklist trước khi duyệt

1. Press owner và outcome có được gọi tên không?
2. Naming line có thật sự là destination name không?
3. Một gesture có đúng một answer không?
4. Link mark có dùng ordinary product treatment không?
5. Press có immediate feedback không?
6. Focus có rõ và activation có parity không?
7. Touch discovery không phụ thuộc hover chứ?
8. Mọi nested control có visual suppression lẫn event ownership không?
9. Handler absent/disabled có bỏ affordance không?
10. Selected/current/drag có được tách khỏi hover/press không?
