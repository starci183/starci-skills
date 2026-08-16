---
id: fe-blocks-laws-b1-one-surface-owner-vi
title: vi.md
slug: /gates/blocks/laws/b1-one-surface-owner/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng mã B1-N nhận diện bằng nghiệp vụ, và vì sao viền thứ hai là một lời nói dối chứ không phải một lựa chọn thẩm mỹ.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `b1-one-surface-owner` · Luật: [`INDEX.md`](./INDEX.md)

# Một khối, một mặt phẳng

Một cái viền không phải là trang trí. Nó là một câu khẳng định: *những thứ nằm trong đây là một
nhóm có tên, và nhóm đó không phải nhóm bao quanh nó*. Khi bạn vẽ hai cái viền quanh cùng một
nhóm, bạn đang nói hai lần về một sự thật, và một trong hai lần là sai.

Đây là luật bị bác nhiều nhất trong toàn bộ kho: **chín lần, trên năm hồ sơ khác nhau**. Nó không
bị bác vì khó hiểu, mà vì mỗi lần cây trust nói nó ở dạng tuyệt đối — "cấm card trong card" — thì
lại có một trường hợp thật mà viền bên trong là đúng, và người viết mã chọn cách bịa một cái viền
thay vì hỏi. Bản đúng của luật không phải "cấm", mà là "một viền phải trả lời được câu hỏi *nó sở
hữu nhóm nào mà chủ bên ngoài không sở hữu*".

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Khối phát ra gì |
|---|---|---|
| `B1-1` | Một đối tượng đứng độc lập dưới một cái tên | đúng một `SurfaceCard` |
| `B1-2` | Một tập hàng đồng hạng dưới một cái tên | đúng một `SurfaceListCard` |
| `B1-3` | Contract của vùng đã khai đây là dải trần | **không mặt phẳng nào** |
| `B1-4` | Một tập hàng riêng, gọi được tên, nằm trong chính card của khối | `SurfaceListCard` bên trong, `isNested: true`, kèm tên chủ bên ngoài |
| `B1-5` | Hai mặt phẳng trong một file nhưng ở hai nhánh **loại trừ nhau** | mỗi nhánh một mặt phẳng — đây không phải lồng |
| `B1-6` | Một viền thứ hai cho đúng cái nhóm mà chủ ngoài đã sở hữu | **không gì cả** — làm phẳng một cái |
| `B1-7` | Khối nằm trong overlay | **không card** — overlay tự nó đã là mặt phẳng |

## `B1-1` — một đối tượng, một card

Tình huống: một câu chuyện đơn có tên, có một con số chính, thường có một nút đổi được kết quả.
Thẻ league, thử thách tuần, độ sẵn sàng nghề đều thuộc nhóm này.

Câu tự hỏi: *nếu bỏ cái viền đi, người đọc có còn biết những thứ này thuộc về nhau không?* Nếu
không, viền là đúng.

Ranh giới với `B1-2`: `B1-1` có một hình chính và phần còn lại bổ nghĩa cho nó; `B1-2` có nhiều
phần tử **đồng hạng** so sánh được với nhau.

## `B1-2` — một tập hàng, một list card

Tình huống: bảng xếp hạng, khoá đang học, gợi ý khoá, người nên theo dõi, changelog. Chúng đồng
hạng nên chúng dính vào nhau bằng đường phân cách chứ không tách ra thành từng card.

Đây là chỗ thầy đã sửa hai lần trên trang chi tiết khoá học: mỗi review một card bị bác, thay bằng
một list dính liền; năm thẻ signal rời bị bác, thay bằng một card chia sáu ô. Cả hai lần lý do là
một: những thứ so sánh được với nhau phải nằm trong cùng một khung để mắt so được.

## `B1-3` — không vẽ mặt phẳng nào

Tình huống: bốn hàng chỉ số trên cột danh tính của dashboard — chuỗi ngày học, xu, thưởng, danh
tính. Không cái nào dựng surface, và đó là **chủ ý ghi trong contract của vùng**, không phải bốn
lần quên.

Đây là mã dễ đọc nhầm nhất. "Không có card" không có nghĩa là "chưa ai bọc nó lại". Nó có nghĩa là
vùng chứa đã tuyên bố mình là dải trần, và một khối tự mọc card ở đó sẽ phá vỡ đúng cái nhịp mà
vùng đang giữ.

## `B1-4` — lồng, và khai báo là lồng

Tình huống: một khối đã có card riêng, bên trong nó có một tập hàng đồng hạng **có tên riêng và
kết quả riêng**. Ví dụ sống: `TopLearners` giữ một `SurfaceCard` bên ngoài mang nhãn khối, và một
`SurfaceListCard` bên trong mang danh sách người học, khai `isNested: true`.

Ba điều kiện phải đúng cùng lúc:

1. Tập bên trong là **hàng đồng hạng** — không phải một nhóm gồm những phần khác loại.
2. Tập bên trong **gọi được tên**: nói được tên nó, thành viên nó, trạng thái riêng và kết quả riêng.
3. Khối **khai tường minh** `isNested: true` và nói ra ai đang giữ mặt phẳng bên ngoài.

Nếu chỉ có điều kiện 3 mà thiếu 1 và 2, thì cờ `isNested` chỉ đang hợp thức hoá một cái viền trang
trí. Thầy đã bác đúng cách đọc đó: có `isNested` **không** làm cho mọi mặt phẳng lồng trở nên hợp lệ.

Sáu chỗ lồng đang sống trong repo và cả sáu đều khai tường minh. Sơn của chế độ lồng nằm trong
đúng một luật CSS: giữ viền, bỏ bóng.

## `B1-5` — hai mặt phẳng, không lồng nhau

Tình huống: một file khai cả `SurfaceCard` lẫn `SurfaceListCard`, nhưng chúng nằm ở hai nhánh
trạng thái loại trừ nhau — nhánh rỗng/lỗi trả về `SurfaceCard` bọc `EmptyNotice`, nhánh sẵn sàng
trả về `SurfaceListCard`. Năm khối đang làm như thế và không khối nào vi phạm `B1`.

Đây là chỗ một cái đếm máy móc sẽ báo sai. Đếm import không nói được gì; phải đọc xem hai mặt phẳng
có bao giờ cùng hiển thị hay không.

## `B1-6` — làm phẳng một cái

Tình huống: cái nhóm bên trong đúng bằng cái nhóm bên ngoài, hoặc không gọi được tên. Khi đó viền
bên trong không sở hữu gì cả.

Ví dụ sống nhất là cột giá: bản xem trước vẽ hai card lồng cho hai ý định *mua* và *học thử*. Thầy
bác, và thay bằng **hai nhóm ngữ nghĩa có tên trong cùng một card**. Sự tách biệt đến từ thứ bậc,
không đến từ card lồng card.

Khi không gọi được tên nhóm, hỏi đúng một câu — *viền này sở hữu nhóm nào mà chủ ngoài không sở
hữu?* — rồi dừng.

## `B1-7` — trong overlay thì không có card

Overlay tự nó đã là một mặt phẳng có ranh giới. Dựng một card bên trong nó là tạo hai chủ sở hữu
cho cùng một ranh giới nhiệm vụ.

Ngoại lệ đã được phán: danh sách kết quả ở cột giữa của Global Search **là** một đối tượng bên
trong có thật, nên nó giữ `SurfaceListCard` ở chế độ lồng. Ngoại lệ này hẹp và có tên, không phải
một cánh cửa mở.

## Vì sao luật bị bác chín lần

Đọc lại năm hồ sơ, ba cách hiểu sai lặp đi lặp lại:

- **Hiểu "một surface owner" thành "cấm mọi viền bên trong".** Sai, vì có những nhóm bên trong là
  thật. Bản đúng là *một viền phải trả lời được nó sở hữu nhóm nào*.
- **Hiểu mọi surface-in-surface là cuộc thi bóng đổ.** Sai, vì chế độ lồng không dùng bóng: nó giữ
  ranh giới bằng viền và bỏ bóng đi.
- **Hiểu cờ `isNested` là giấy phép.** Sai, nó là điều kiện cần. Điều kiện đủ là cái nhóm bên trong
  có thật.
