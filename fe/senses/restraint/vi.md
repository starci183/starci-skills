---
id: fe-senses-restraint-vi
title: vi.md
slug: /fe/senses/restraint/vi
sidebar_label: vi.md
sidebar_position: 1
description: Hướng dẫn tiếng Việt để mỗi emphasis, edge và control phải chứng minh một công việc.
---

# vi.md

> Version: `1.02` · Hướng dẫn tiếng Việt · Luật cho AI: [`INDEX.md`](./INDEX.md) · Ví dụ trực quan: [`example.md`](./example.md)

## Restraint không có nghĩa là làm giao diện trống

Restraint là một gate rất ngắn:

> Mỗi emphasis, edge và control phải chứng minh một công việc quan sát được.

Module này không tự quyết heading to bao nhiêu, card có border gì hay button nào primary. Nó chỉ bắt
mọi thứ mới xuất hiện khai báo job, rồi chuyển quyết định cho module có evidence sâu hơn:

- emphasis → [hierarchy](../hierarchy/INDEX.md);
- edge → [surface-in-surface](../../gates/principles/surface-in-surface/INDEX.md);
- control → [call-to-action](../call-to-action/INDEX.md).

Restraint cũng không đồng nghĩa “ít content”. Curriculum cần module, bài, thời lượng, trạng thái và
progress để người học hiểu khóa học. Reviews cần rating, tổng lượt, cohort và nhận xét để tạo evidence.
Xóa content cần thiết chỉ để card thấp hơn không phải restraint; đó là mất thông tin.

## Một job phải quan sát được

| Không đủ | Job có thể kiểm |
|---|---|
| “Cho đẹp hơn” | Cho biết đây là trạng thái lỗi cần recovery |
| “Nhìn premium” | Vẽ boundary membership cho một joined list |
| “Cân card” | Đặt một lead theo reading order đã chọn |
| “Cho rõ” | Mở disclosure chứa filter đang áp dụng |
| “Có thêm lựa chọn” | Cho người dùng copy link review khi context cần |

Một job không tự làm implementation đúng. Edge có membership job vẫn phải vượt luật surface. Control
có outcome vẫn phải vượt CTA hierarchy. Emphasis có rank job vẫn phải nằm trong emphasis budget.

## Gate cho emphasis

Inventory mọi thứ giành attention: size, weight, colour, badge, icon, highlight, motion. Với mỗi thứ,
hỏi nó đang mang rank hay semantic state nào.

Ví dụ course card đã có title lead, progress support và metadata detail. Thêm badge gradient “HOT”,
icon lửa và cover pulse đều nói cùng một điều mơ hồ. Nếu popularity là evidence thật, một count/label
có thể được giữ và hierarchy quyết định rank. Ba tín hiệu lặp phải bỏ.

Không bỏ focus ring, error text hoặc selected state để “quiet” hơn. Đó là semantic/accessibility cue,
không phải unearned decoration.

## Gate cho edge

Mỗi border, ground, shadow hoặc card wrapper phải nói “những members này thuộc cùng một region”. Nếu
page section đã chứa một grid course cards, thêm outer card quanh cả section có thể lặp membership mà
heading và spacing đã nói đủ. Route sang surface-in-surface để merge/flatten.

Joined review rows có thể cần một edge để nói chúng là một list liên tục và để clip selection; đó là
job cụ thể. Nhưng từng rating, comment và action không cần mỗi thứ một card nhỏ.

## Gate cho control

Inventory mọi button, link, menu item, tab, filter, retry và disclosure. Gọi tên outcome/utility/path.

Course card có `Tiếp tục học` là core outcome, `Xem đề cương` có thể là detail path, `Chia sẻ` có thể là
utility. Nếu thêm `Khám phá`, `Bắt đầu`, `Học ngay`, `Xem chi tiết` cùng primary appearance, các control
không chứng minh bốn job riêng; chúng cạnh tranh một ask. CTA module quyết định merge/demote/remove.

Review row menu không nên có `Chỉnh sửa`, `Xóa`, `Báo cáo`, `Ẩn`, `Ghim`, `Chia sẻ`, `Copy`, `Mở hồ sơ`
cho mọi viewer. Permission và context phải quyết định control nào có job thật.

## Duplicate job là dấu hiệu chính

Hai element có thể tự khai báo job nhưng vẫn lặp nhau:

- title lớn và badge “Featured” cùng cố làm lead;
- outer card và inner card cùng nói một membership;
- primary button ở header và footer cùng đưa đến một outcome;
- error banner và toast cùng báo một lỗi nhưng recovery chỉ ở nơi khác.

Giữ owner gần task nhất, merge thông tin hoặc demote phần còn lại. Không cố làm mọi thứ “đều nổi”.

## State và responsive

- Loading không thêm spinner fixed + skeleton + progress text nếu một cue đủ giải thích state.
- Empty giữ message và path onward; bỏ illustration nếu nó không thêm meaning, nhưng không bỏ action
  recovery chỉ để panel trống.
- Error cần tên vấn đề và recovery; red edge thứ ba không thay được copy.
- Mobile không tự thêm floating CTA vì primary bị đẩy xuống; sửa hierarchy/action anchor trước.
- Desktop không thêm side rail chỉ để lấp khoảng rộng; region phải có task riêng.

## Checklist review

- [ ] Surface job đã được viết trong một câu chưa?
- [ ] Đã inventory tất cả emphasis, edge và control chưa?
- [ ] Mỗi candidate có job quan sát được, không phải adjective thẩm mỹ?
- [ ] Hai candidate nào đang làm cùng một job?
- [ ] Candidate hợp lệ đã được route sang owner module chưa?
- [ ] Có đang xóa content/evidence cần thiết thay vì presentation thừa không?
- [ ] Focus, status, error, recovery và path onward còn đủ không?
- [ ] Loading/empty/error/mobile có thêm furniture không tồn tại trong ready/wide không?

Kết quả tốt không phải “càng ít càng tốt”, mà là **không có thứ nào hiện diện mà không giải thích
được vì sao nó cần cho task**.
