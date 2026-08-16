---
id: fe-senses-restraint-example
title: example.md
slug: /fe/senses/restraint/example
sidebar_label: example.md
sidebar_position: 2
description: When/not-when scenarios for earned emphasis, boundaries, and controls.
---

# example.md

> Version: `1.02` · Module: `restraint` · Hướng dẫn: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mỗi ví dụ giữ content/evidence cần cho task và chỉ loại **presentation hoặc control không chứng minh
được job**. Live UI phải cho thấy course/review thật; “clean card” rỗng không phải restraint.

## 1. Course overview: evidence dày, presentation có kỷ luật

**Surface job:** giúp học viên hiểu mình đang học gì và tiếp tục đúng chỗ.

**Giữ:** title `System Design Mastery`; instructor; 6 module, 42 bài, 18 giờ; progress 68%; next lesson
`Replication strategies · 24 phút`; primary `Tiếp tục học`; quiet path `Xem đề cương`.

**Bỏ/demote:** gradient badge “HOT”, icon lửa, pulse cover, ba metrics cùng lead size, hai nút `Học
ngay` và `Tiếp tục` cùng primary. Content vẫn chi tiết; chỉ attention/control trùng job bị loại.

<CodeUiTabs example="restraint-course-overview" />

## 2. Student reviews: một summary, evidence thật

**Surface job:** giúp người đọc đánh giá chất lượng khóa học từ aggregate và trải nghiệm học viên.

**Giữ:** 4,9/5, 328 lượt, 96% đề xuất, distribution có label, review có avatar, cohort, rating, comment.

**Bỏ/demote:** ba card nhỏ lặp `4,9`, `5 sao`, `Xuất sắc`; decorative quote marks trên mọi row; button
`Xem`, `Đọc`, `Chi tiết` cùng destination. Route rank sang hierarchy, row boundary sang surface.

<CodeUiTabs example="restraint-student-reviews" />

## 3. Edge gate: section không cần card quanh cards

**When:** course page section `Nội dung khóa học` có heading ngoài, bên trong là peer module surfaces hoặc
joined rows. Heading + spacing đã nói section membership; individual card/list edge có job riêng.

**Not when:** thêm outer Card quanh toàn section rồi giữ inner Card cho từng module, tạo box-around-box
chỉ để “gọn”. Candidate outer edge không có membership job khác.

<CodeUiTabs example="restraint-edge-gate" />

## 4. Control gate: một ask, utilities đúng tier

**When:** enrolled course card có `Tiếp tục học` primary, `Xem đề cương` secondary path và menu chứa
utility `Chia sẻ`. Mỗi control có job/destination riêng.

**Not when:** `Tiếp tục`, `Học ngay`, `Mở khóa học`, `Xem bài tiếp` đều primary và cùng destination;
hoặc mọi review row cho mọi viewer đủ 8 menu actions không theo permission.

<CodeUiTabs example="restraint-control-gate" />

## 5. Emphasis gate: một lead và semantic state

**When:** long course title là lead; progress và next lesson support; deadline warning chỉ lên màu khi
thật sự sắp hạn; completion badge mang semantic state.

**Not when:** title, price, rating, progress và button đều accent/large/bold. “Tất cả quan trọng” làm
không còn thứ gì dẫn. Candidate cần route sang hierarchy.

<CodeUiTabs example="restraint-emphasis-gate" />

## 6. Review overlay: chỉ action có quyền và context

**When:** learner xem review của người khác có `Sao chép liên kết`, `Báo cáo`; review của chính mình có
`Chỉnh sửa`, `Xóa`. Moderator có controls khác theo permission.

**Not when:** một universal menu liệt kê pin/hide/delete/edit/report/share/profile/message/copy cho mọi
viewer để “đầy đủ”. Control không có job khả dụng trong context phải không xuất hiện.

<CodeUiTabs example="restraint-review-actions" />

## 7. State cues: đủ meaning và recovery, không cue chồng cue

**Loading:** skeleton rows trong review body; không thêm spinner fixed và text progress nếu không cần.

**Empty:** `Chưa có đánh giá` + điều kiện gửi review/path onward; illustration chỉ giữ nếu thêm meaning.

**Error:** `Không thể tải đánh giá` + `Thử lại`; không dùng border đỏ + toast + banner + modal cùng báo
một lỗi. Không bỏ recovery để giao diện “sạch”.

<CodeUiTabs example="restraint-state-cues" />

## 8. Responsive: không thêm furniture để lấp chỗ

**When:** desktop course detail có optional curriculum rail vì rail giúp navigate 6 module; mobile đổi
thành disclosure `Nội dung · 6 module`. Source/task được giữ.

**Not when:** desktop thêm side card `Gợi ý`, `Mẹo`, `Có thể bạn thích` chỉ để lấp whitespace; mobile
thêm floating primary vì action gốc bị hierarchy đẩy quá xa.

<CodeUiTabs example="restraint-responsive-furniture" />

## Candidate ledger mẫu

| Candidate | Kind | Job | Owner | Decision |
|---|---|---|---|---|
| Course title size | Emphasis | Lead identity | Hierarchy | Keep + validate |
| Progress chip | Emphasis | Completion state | Hierarchy | Keep, support tier |
| “HOT” + flame + pulse | Emphasis | Cùng claim popularity mơ hồ | Hierarchy | Remove/merge into evidence |
| Outer section card | Edge | Không khác inner membership | Surface | Remove |
| Joined review edge | Edge | Peer-list membership + clipping | Surface | Keep + validate |
| `Tiếp tục học` | Control | Resume next lesson | CTA | Keep primary |
| `Học ngay` duplicate | Control | Same destination | CTA | Remove |
| Retry trong error | Control | Recovery | CTA | Keep in failed state |
| Focus ring | Emphasis/state | Keyboard focus visibility | Accessibility/state | Keep; never remove for quietness |

## Câu review ngắn

> “Candidate ______ là ______; job quan sát được là ______; owner module ______; nó có/không duplicate
> ______; quyết định ______.”

Nếu chỉ điền được “đẹp”, “cân”, “premium” hoặc “rõ hơn”, candidate chưa kiếm được quyền tồn tại.
