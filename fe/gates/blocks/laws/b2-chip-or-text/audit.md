---
id: fe-blocks-laws-b2-chip-or-text-audit
title: audit.md
slug: /gates/blocks/laws/b2-chip-or-text/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện bảng tra B2: nó phân định được tới đâu, và bốn chỗ repo sống đang không theo.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `b2-chip-or-text`

## Kết luận

Chấp nhận. Bảng tra đóng, ba câu hỏi loại trừ được, và mọi hàng đều có neo.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `B2-1` so với `B2-3` | Loại trừ được: một con số không tự đổi nghĩa, nó chỉ đổi giá trị |
| `B2-2` so với `B2-3` | Loại trừ được bằng câu hỏi ba — tone có nghĩa hay không |
| `B2-3` so với `B2-5` | Loại trừ được bằng số kết cục; quá bốn thì chip thành chú giải |
| `B2-4` so với `B2-3` | Loại trừ được: cái đang chọn do người đọc đổi, nên trượt câu hỏi một |
| `B2-6` so với `B2-2` | Loại trừ được: glyph không thêm thông tin nào so với chữ bên cạnh |
| `B2-7` so với mọi mã | Loại trừ được bằng producer; không producer thì không có field |
| Field không có trong bảng | Rơi về `B2-2`, không rơi về "tuỳ người viết" |

## Repo sống đang ở đâu

**Đang vi phạm ở bốn khối và một leaf.** `ProfileHero` (nơi ở, hình thức làm việc),
`CoursePricingRail` (tên giai đoạn giá), `ProblemReadingColumn` (tag), `SolutionEditor` (nhãn
testcase khi chưa chạy), và nhánh `results` của `SelectionList` vẫn giữ chuỗi class pill đã bị bác ở
nhánh `scopes`.

Chỗ đáng chú ý: `CoursePricingRail` không phải một chỗ chưa ai phán. Có một dòng từ chối viết đúng
cho field đó — "Phase comparison cần typography đồng cấp, không cần chip chrome" — mà mã hiện tại
vẫn vẽ `Badge` tone `accent`. Đây là một phán quyết đã trôi mất, không phải một khoảng trống.

## Nhận định

- Không có rule lint nào nhắc tới `Badge`. Cả bảng tra này hôm nay được giữ bằng người đọc, và gate
  chỉ chặn được phần khai báo: `render: "badge"` cộng `isRealState: false` bị schema từ chối.
- Ngoại lệ "cấp độ khoá học" được suy ra từ một dòng từ chối nói về **tone**, không nói về
  chip-hay-chữ. Đây là suy luận có neo gián tiếp, và nó là chỗ yếu nhất của mô-đun: nếu thầy phán
  ngược, hàng ngoại lệ này rơi.
- Nhánh `results` của Global Search là **mâu thuẫn đo được**, chưa phải **vi phạm đã được phán**.
  Dòng từ chối nhắm vào nhánh `scopes`, và một dòng khác nói rõ hàng kết quả cố ý giữ anatomy riêng.
  Câu hỏi còn mở: `kindLabel` có được phép đeo pill ở hàng kết quả không. Chỗ này cần thầy trả lời,
  không đo được từ mã.
- Ngưỡng "quá bốn kết cục thì chuyển sang `B2-5`" là **suy luận, không có neo**. Con số bốn đến từ
  quan sát hai đầu mút — ba tone của cấp độ vẫn đọc được, mười một verdict thì không — chứ không từ
  một phán quyết.
