---
id: fe-governance-exception-vi
title: vi.md
slug: /fe/governance/exception/vi
sidebar_label: vi.md
sidebar_position: 1
description: Hướng dẫn tiếng Việt để nhận diện, đặt tên và giới hạn ngoại lệ thiết kế.
---

# vi.md

> Version: `1.02` · Luật cho AI: [`INDEX.md`](./INDEX.md) · Ví dụ trực quan: [`example.md`](./example.md)

## Ngoại lệ không phải một default mới

Exception xuất hiện khi một màn hình có quan hệ thật mà reusable rule không biểu đạt được. Nó không
phải lý do để mở rule chung “cho linh hoạt”, cũng không phải nơi gom mọi khác biệt nhìn thấy trên UI.

Mindset cốt lõi:

> Gọi tên sự khác biệt, giữ nó local, và nói rõ ai không được phép copy nó.

Nếu thêm một option vào shared primitive chỉ vì một trang cần, mọi trang khác bỗng có permission dù
không có evidence. Đó là widening, không phải xử lý exception.

## Khi nào một case đủ điều kiện?

Case phải trả lời được:

- **Tên:** composition/relationship nào đặc biệt?
- **Scope:** đúng flow, surface hoặc product context nào?
- **Generic rule:** luật chung nào vẫn giữ nguyên?
- **Evidence:** quan hệ nào luật chung không thể hiện?
- **Local decision:** khác biệt nhỏ nhất là gì?
- **Non-transfer:** vì sao màn hình khác không được copy?
- **Exit condition:** khi nào xóa hoặc xét lại exception?

Nếu chỉ có câu “màn này nhìn chưa đẹp” hoặc “thiết kế muốn khác”, chưa đủ. Đó có thể là redesign,
content problem hoặc thiếu grouping, không nhất thiết là exception.

## Ví dụ course content

Một curriculum list mặc định hiển thị module theo thứ tự. Riêng capstone module cần block prerequisite
vì học viên chưa hoàn thành assessment. Exception hợp lệ không phải là thêm `locked description` cho
mọi curriculum row. Hãy đặt tên `capstone-prerequisite-row`, giới hạn ở capstone, giữ ordinary row đóng,
và ghi exit condition: khi prerequisite hoàn tất, row quay về ordinary state.

Nội dung cụ thể cần thấy:

- module `Capstone: Production Architecture`;
- yêu cầu `Hoàn thành Assessment 3`;
- trạng thái hiện tại `2/3 tiêu chí`;
- action `Xem yêu cầu`;
- ordinary modules bên cạnh không nhận thêm wrapper hoặc copy.

## Ví dụ student reviews

Review list mặc định có rating, student, date và comment. Một review đang moderation vì chứa thông tin
cá nhân cần local state: giữ vị trí row để chronology không nhảy, thay comment bằng explanation và
action phù hợp cho reviewer. Không thêm `moderation panel` vào mọi review card.

Exception tên `review-moderation-placeholder`, scope đúng row đang review, generic review giữ nguyên.
Exit condition: moderation resolve thì row trở lại approved/removed state chuẩn.

## Exception nhỏ nhất có thể

Chỉ seam hoặc behavior có evidence được phép khác. Nếu case chỉ cần một message phụ, không được nhân đó
đổi radius, typography, button order và spacing toàn card. Exception càng rộng càng khó phân biệt với
redesign không được tuyên bố.

## Không copy-paste exception

Hai màn hình trông giống nhau chưa chắc có cùng relationship. Khi case thứ hai xuất hiện:

1. Đánh giá lại bằng generic rule.
2. Nếu vẫn không đáp ứng, đặt tên exception riêng cùng evidence riêng.
3. Chỉ cân nhắc thay đổi generic rule khi có nhiều evidence độc lập chứng minh default hiện tại sai.

Không “promote” exception thành pattern chỉ vì source code được copy hai lần.

## Vocabulary boundary

UI dùng vocabulary người đọc hiểu trong product context. API, database hoặc integration có thể dùng
tên khác; map tên ở boundary trước khi copy đến pure UI. Đây là nguyên tắc boundary, không phải danh
sách từ khóa universal trong module này. Vocabulary cụ thể phải do product record sở hữu.

## Review và exit

Mỗi exception cần owner và thời điểm xem lại. Exit condition có thể là:

- state kết thúc;
- upstream limitation được bỏ;
- product flow được hợp nhất;
- evidence mới cho thấy generic rule cần sửa;
- feature bị gỡ.

Exception không có exit condition thường trở thành debt vĩnh viễn mà không ai nhớ lý do.

## Checklist

- Tên có mô tả relationship thay vì tên ticket không?
- Scope có nhỏ hơn reusable rule không?
- Evidence có kiểm chứng được không?
- Generic rule có giữ đóng không?
- Local difference có tối thiểu không?
- Có ghi rõ nơi không được copy không?
- Có vocabulary mapping ở boundary nếu cần không?
- Có owner và exit condition không?
