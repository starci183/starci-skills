---
id: fe-senses-hierarchy-example
title: example.md
slug: /fe/senses/hierarchy/example
sidebar_label: example.md
sidebar_position: 2
description: Ví dụ chi tiết và live UI về reading order cho course content và student reviews.
---

# example.md

> Version: `1.02` · UI demo phải có nội dung đủ thật để kiểm reading order.

## Nội dung khóa học: task là tiếp tục học

Surface có course `System Design Mastery`, tiến độ `68%`, `16/24 nội dung`, current module `Caching
và consistency`, nội dung tiếp theo `Cache invalidation trong production`, thời lượng `18 phút`, nút
`Tiếp tục học`.

**Reading order đúng:** `68% hoàn thành` → `Nội dung tiếp theo` → title cụ thể → supporting metadata →
action. Người rời sau hai element vẫn biết trạng thái và đường tiếp tục.

**Not when:** course title, 68%, badge `Đang học`, module title và button đều bold/large. Đó không phải
nhiều thông tin quan trọng; đó là không có lead.

<CodeUiTabs example="hierarchy-course-progress" />

## Đánh giá học viên: task là đánh giá chất lượng

Surface có `4.9/5`, `128 đánh giá`, `94% đề xuất`, distribution `5★ 86%`, và review gần nhất từ Minh
Anh: “Phần lab cache giúp mình nhìn ra lỗi stale data trong dự án thật.”

**Reading order đúng:** aggregate score → sample size/recommendation → distribution → review evidence.
Avatar và student name hỗ trợ credibility nhưng không giành lead. Nút `Viết đánh giá` là action, không
thay score làm nội dung chính.

**Not when:** heading `Đánh giá học viên` dẫn mạnh hơn score, hoặc review đầu tiên lớn hơn aggregate
evidence khiến một ý kiến cá nhân trông như kết luận toàn bộ.

<CodeUiTabs example="hierarchy-student-reviews" />

## Hai section trên cùng course page

`Nội dung khóa học` và `Đánh giá học viên` là hai page section. Hierarchy nội bộ của từng section phải
được giải quyết riêng. Page hierarchy sau đó quyết định section nào đến trước theo task: với enrolled
learner, progress/curriculum đến trước; với visitor đang cân nhắc mua, overview/reviews có thể đến trước.

Không dùng một typography scale lớn cho mọi section heading, metric và card title. Rank ở page level và
rank bên trong card là hai context khác nhau.

<CodeUiTabs example="hierarchy-course-page" />

## Loading, empty, error và ready

Course progress ready state giữ ba anchor: progress, next content, action. Loading skeleton đúng các
anchor. Empty state `Chưa bắt đầu` vẫn chiếm lead position. Error state `Chưa tải được tiến độ` nằm ở
support/detail position cùng retry; không xóa course title và dựng spinner giữa card.

Review ready state có score và sample size. Loading giữ score skeleton trước distribution. Empty state
`Chưa có đánh giá` dẫn, sau đó giải thích và action mời review. Không chuyển avatar placeholder thành
lead chỉ vì dữ liệu khác chưa resolve.

<CodeUiTabs example="hierarchy-state-parity" />

## Source order và responsive

Desktop có score ở cột trái, review breakdown ở cột phải. Source order vẫn phải là score → sample →
breakdown → reviews. Mobile stack theo đúng order này. Không đặt breakdown trước trong DOM rồi dùng grid
placement kéo score lên trên desktop.

<CodeUiTabs example="hierarchy-source-order" />

## Fit trap với course title dài

Hai course card peer dùng cùng heading rank:

- `Docker từ nền tảng đến production`;
- `Thiết kế hệ thống chịu tải và quan sát production`.

Title thứ hai wrap hai dòng. Không hạ font size riêng để ép một dòng. Nếu card phải giữ chiều cao cố
định, truncate hai dòng với full title trong accessible label/tooltip phù hợp.

<CodeUiTabs example="hierarchy-long-title" />

## Ma trận khi nào / không khi nào

| Tình huống | Dẫn bằng | Không dẫn bằng |
|---|---|---|
| Enrolled learner dashboard | Progress và next content | Course category badge |
| Public course page | Course value proposition hoặc decision evidence | Tên component `Overview` |
| Review summary | Aggregate score + sample | Avatar của review đầu tiên |
| Failed progress fetch | Stable course context | Error icon toàn card |
| Long title | Cùng size theo rank, cho wrap | Size nhỏ hơn để fit |
| Two-column desktop | Source first element | Element được CSS kéo lên |
| Empty reviews | `Chưa có đánh giá` + explanation | Blank card hoặc spinner |
| Dense metric row | Một lead metric | Tất cả metric cùng emphasis |
