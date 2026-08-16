---
id: fe-senses-hierarchy-vi
title: vi.md
slug: /fe/senses/hierarchy/vi
sidebar_label: vi.md
sidebar_position: 1
description: Hướng dẫn tiếng Việt về reading order, emphasis budget và hierarchy qua mọi state.
---

# vi.md

> Version: `1.02` · Luật cho AI: [`INDEX.md`](./INDEX.md) · Ví dụ trực quan: [`example.md`](./example.md)

## Hierarchy là thứ tự người xem hiểu

Mọi surface đều có hierarchy, kể cả khi không ai chủ động thiết kế. Người xem sẽ đọc thứ dễ thấy
nhất trước, rồi đi theo con đường layout tạo ra. Thiết kế hierarchy là quyết định con đường đó trước
khi font size, weight, màu và spacing vô tình quyết định thay mình.

Câu kiểm tra quan trọng:

> Nếu người xem chỉ đọc hai phần đầu rồi rời đi, họ đã hiểu được điểm chính chưa?

## Viết reading order trước khi style

Hãy viết một câu rất cụ thể:

```text
1. Điểm khóa học 4.9/5
2. 128 học viên đã đánh giá, 94% đề xuất
3. Nhận xét gần đây của Minh Anh
```

Đây là product decision. Nếu bắt đầu bằng component và typography, layout đã tạo ra thứ tự trước khi
ta kịp kiểm tra xem thứ tự đó có phục vụ task không.

## Emphasis là ngân sách cố định

Prominence chỉ tồn tại vì hàng xóm yên hơn. Nếu heading, value, badge, delta và button đều bold, lớn,
màu mạnh thì không phần nào dẫn. Khi tăng emphasis cho một element, phải giảm emphasis ở nơi khác.

Ví dụ review summary:

- Lead: `4.9 / 5`.
- Support: `128 đánh giá · 94% đề xuất`.
- Detail: distribution 5 sao đến 1 sao.
- Action `Viết đánh giá` quan trọng về thao tác nhưng không được giành vị trí đọc đầu với score.

## Một thứ dẫn

Surface `Nội dung khóa học` có thể dẫn bằng `68% hoàn thành` nếu task là tiếp tục học, hoặc dẫn bằng
`24 nội dung` nếu task là xem phạm vi giáo trình. Không để cả hai cùng size, weight và màu rồi bắt
người xem tự chọn điểm bắt đầu. Một surface có thể chứa nhiều fact quan trọng, nhưng chỉ một fact dẫn.

## Position và size trước, colour sau

Hierarchy phải tồn tại khi:

- xem dark mode;
- chụp màn hình grayscale;
- dùng display low-contrast;
- người đọc không phân biệt được hai màu.

Position và size mang rank. Colour nói kind: warning, success, link, disabled. Không dùng ba màu khác
nhau để thay ba cấp hierarchy trong khi tất cả cùng size và position.

## Source order bằng visual order

CSS không được kéo lead lên trên một element đứng trước nó trong source. Keyboard, screen reader và
mobile viewport vẫn theo source order, tạo hai giao diện khác nhau. Sửa DOM/source order rồi để layout
theo sau.

## Group trước, rank sau

Một value lớn đứng cạnh các item không có grouping chỉ trông như một object xa lạ. Trước khi rank,
phải làm rõ member thuộc cùng group bằng proximity, shared ground hoặc boundary có nghĩa. Hierarchy
hoạt động bên trong grouping đã được thiết lập; xem [surface-in-surface](../../gates/principles/surface-in-surface/INDEX.md).

## Không hạ size để vừa

Title dài không được giảm một size chỉ để giữ một dòng, vì size đang nói title đó ít quan trọng hơn
title ngắn ở card khác. Dùng wrapping, truncate nhưng vẫn truy cập được full value, hoặc sửa copy.

Ví dụ `Thiết kế hệ thống chịu tải và quan sát production` có thể wrap hai dòng ở cùng heading size;
không thu nhỏ riêng card này.

## Giữ order trong mọi state

Ready state course progress có:

1. `68% hoàn thành`;
2. `16/24 nội dung`;
3. `Tiếp tục: Observability căn bản`.

Loading state phải skeleton đúng ba vị trí đó. Không thay toàn card bằng spinner giữa màn hình. Empty
state vẫn giữ heading và nói rõ chưa có progress. Failed state giữ nơi của section và hiển thị retry
ở đúng tầng detail/action, không biến error thành lead toàn trang nếu task chính vẫn còn.

## Hierarchy nông

Người đọc theo được lead, support và detail. Cấp bốn, năm chỉ hơi khác nhau sẽ thành noise. Nếu xuất
hiện một loại nội dung mới, đừng tự động thêm style level; đặt nó vào ba tầng hiện có hoặc hỏi nó có
thật sự thuộc surface này không.

## Heading phải giúp quyết định dừng lại

Heading `Card`, `Overview component` hoặc `Statistics` nói cơ chế, không nói điểm. Heading tốt như:

- `Bạn đã hoàn thành 68% khóa học`;
- `Học viên đánh giá cao phần thực hành`;
- `Ba nội dung tiếp theo`;
- `Điểm cần ôn trước milestone`.

Người scan headings biết section có đáng dừng không.

## Hierarchy khác call to action

Hierarchy quyết định người xem hiểu gì theo thứ tự nào. Call to action quyết định surface yêu cầu họ
làm gì. Nút primary có thể được chọn đúng nhưng vẫn không được thấy nếu ba element khác tranh lead.

## Checklist review

- Viết được first/second/third chưa?
- Chỉ có một lead chưa?
- Element được emphasize thêm có element nào được demote không?
- Rank còn tồn tại nếu bỏ màu không?
- Source order có đúng visual order không?
- Title dài giữ nguyên rank chưa?
- Loading/empty/error có giữ reading order không?
- Heading nói point hay chỉ nói tên component?
