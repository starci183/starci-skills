---
id: fe-blocks-laws-b5-no-invented-field-vi
title: vi.md
slug: /gates/blocks/laws/b5-no-invented-field/vi
sidebar_label: vi.md
sidebar_position: 1
description: Không có producer thì không có field; và vì sao một con số bịa nguy hiểm hơn một chỗ trống.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `b5-no-invented-field` · Luật: [`INDEX.md`](./INDEX.md)

# Không bịa field

Một chỗ trống thì người đọc **thấy** là trống. Một con số bịa thì người đọc tin. Đó là toàn bộ lý do
của luật này: sai mà nhìn giống đúng thì tệ hơn thiếu.

## Bảng tra

| Mã | Tình huống | Khối làm gì |
|---|---|---|
| `B5-1` | Thiết kế vẽ một dữ kiện không có producer | không vẽ, và báo thiếu producer |
| `B5-2` | Producer trả boolean, không trả số | vẽ sự có mặt, **không** vẽ số |
| `B5-3` | Một chuỗi hiển thị gõ thẳng vào mã | chỉ được phép với danh từ riêng |
| `B5-4` | Một field lấy về mà không hiển thị | đó là thừa trong query, không phải trục để dựng thêm state |
| `B5-5` | Một con số suy ra từ field đã có | được, nhưng vẫn là thêm nội dung, nên vẫn phải có lý do |

## `B5-2` — boolean không nở thành số

Nút AI nổi có `hasUnread?: boolean` và vẽ một badge `content: "1"`. Ba người khác nhau nhìn màn hình
đó sẽ đọc ra ba điều: có một tin, có ít nhất một tin, hoặc có một cuộc trò chuyện. Chỉ có điều thứ
hai là thật, và đó là điều duy nhất mà kiểu dữ liệu nói được.

Cách đã được phán ở menu tài khoản: không badge cho tới khi API có count thật. Nếu chỉ cần nói "có
tin mới" thì dùng một dấu hiệu **không mang số**.

## `B5-4` — lấy về mà không vẽ

Đây là cái bẫy tinh vi hơn. Một field có mặt trong query, không hiển thị ở đâu cả, và người đọc mã
sau đó tưởng nó là một trục còn thiếu — rồi dựng một state cho nó. `DailyQuest` lấy về trường `date`
và không vẽ nó ở bất kỳ đâu; một bản dựng mù đã biến `date` thành sự thật trung tâm và thêm hẳn một
state `ngay-da-lat` mà sản phẩm không có.

Field lấy về mà không vẽ là **thừa trong query**. Bỏ nó, hoặc giải thích vì sao nó ở đó.

## `B5-5` — suy ra thì không phải bịa, nhưng vẫn là thêm

"Ba trên năm việc đã xong" suy được từ danh sách, nên nó không vi phạm `B5`. Nhưng nó là một câu mới
trên màn hình, và một câu mới là một quyết định sản phẩm. Đưa nó vào kế hoạch với lý do, hoặc bỏ.

## Đo được

Đúng **ba** chuỗi hiển thị gõ thẳng trong toàn tầng block, trên sáu mươi hai đơn vị. Hai là danh từ
riêng: `GitHub`, `LinkedIn`. Cái thứ ba là con số `1` của FAB.

Tỉ lệ đó nói rằng luật này đang được giữ tốt. Nó cũng nói rằng vi phạm còn lại là một vi phạm đơn
lẻ, sửa được trong một dòng.
