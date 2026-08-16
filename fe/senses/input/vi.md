---
id: fe-senses-input-vi
title: vi.md
slug: /fe/senses/input/vi
sidebar_label: vi.md
sidebar_position: 2
description: Bảng tính business-to-component cho Input trong StarCi Academy.
---

# vi.md

> Version: `1.03` · Canon: [`INDEX.md`](./INDEX.md) · Tests: [`prompt.md`](./prompt.md) · UI: [`example.md`](./example.md)

**Tên:** Input

**Mô tả:** Từ job, loại value, owner của nhãn, hành vi search và state, tính ra đúng một
`Field`, `Input`, `SearchBox`, `SearchCommandField`, `PressableInputLike` hoặc
`INSUFFICIENT CONTEXT`.

## Canon at a Glance

| Business fact | Kết quả | Vì sao |
|---|---|---|
| Form cần một ô có nhãn luôn hiện để nhập email | `Field kind="email"` | Nhãn thuộc field và value cần keyboard/autocomplete email |
| Form cần nhập mật khẩu đang dùng để đăng nhập | `Field kind="password"` | Đây là current password, không phải password sắp tạo |
| Form cần tạo hoặc đặt lại mật khẩu | `Field kind="newPassword"` | Đây là new password, không phải credential hiện tại |
| Form cần nhập mã xác minh một lần chỉ gồm chữ số | `Field kind="code"` | One-time code cần numeric input mode và OTP autocomplete |
| Form cần nhập tên khóa học, username hoặc câu text thường | `Field kind="text"` | Không có semantics email, secret hay OTP |
| Named auth contract đã sở hữu nhãn email liên kết bằng `id`, hint/error và layout; chỉ thiếu ô gõ | `Input kind="email"` | Dựng thêm `Field` sẽ nhân đôi owner của nhãn |
| Thanh công cụ cho nhập query, nhấn Enter để search và clear để trả danh sách về mặc định | `SearchBox` | Search tự submit và tự sở hữu clear trong một bar |
| Global search giữ query trong overlay, dùng Arrow Up/Down chọn kết quả và Enter mở kết quả | `SearchCommandField` | Đây là controlled combobox có active result và keyboard navigation |
| Control ở navbar chỉ được bấm để mở global search; không gõ trực tiếp vào đó | `PressableInputLike` | Job là open search, không phải edit query |
| Email đăng ký bị từ chối và đã có câu giải thích format cụ thể | `Field kind="email" isInvalid` + `hint` | `Field` nối refusal copy với email và announce lỗi |
| Tên khóa học chưa tải xong nên chưa thể edit | `Field kind="text" isLoading` | Loading giữ đúng geometry bằng skeleton của product |
| Form tên khóa học đang submit nên tạm thời không cho sửa | `Field kind="text" disabled` | Đây là state tạm thời của đúng text field |
| Mã học viên chỉ để đọc, không có edit job | `INSUFFICIENT CONTEXT` | Input canon không chọn component hiển thị dữ liệu |
| Chỉ yêu cầu “quiet”, “outlined”, “p-0” hoặc “màu nhẹ hơn” | `INSUFFICIENT CONTEXT` | Appearance không cho biết job hay behavior |
| Cần date picker, tiền tệ có prefix, generic suffix, controlled value hoặc pending validation | `INSUFFICIENT CONTEXT` | Public Input contract hiện không biểu diễn đủ behavior này |

## Output Explanations

### Cách tính

1. Xác định **job**: edit một form value, search một tập kết quả, open global search hay chỉ đọc.
2. Nếu thiếu job, trả `INSUFFICIENT CONTEXT` ngay; không suy từ mockup hay tên class.
3. Với search, dùng behavior để chọn đúng một owner:
   - query tự submit/clear trong bar → `SearchBox`;
   - overlay giữ query, active result và keyboard navigation → `SearchCommandField`;
   - bấm navbar để mở overlay, không nhận text → `PressableInputLike`.
4. Với edit form value, hỏi ai sở hữu nhãn/hint/error:
   - field tự sở hữu → `Field`;
   - một contract đã nối nhãn bằng `id` và sở hữu message/layout → `Input`.
5. Map **loại value**: email → `email`; mật khẩu hiện tại → `password`; mật khẩu sắp tạo →
   `newPassword`; mã một lần → `code`; còn lại → `text`.
6. Sau khi có owner, mới thêm state được public API hỗ trợ: loading → `isLoading`; validation refusal có
   copy → `isInvalid` + `hint`; khóa tạm trong lúc submit → `disabled`.
7. Behavior còn thiếu hoặc nằm ngoài public API → `INSUFFICIENT CONTEXT`; không tự chế wrapper,
   variant, adornment hay state.

### `Field`

Output mặc định cho một form value có nhãn. Nó giữ label, Input, hint/error và quan hệ accessibility
trong một contract. `kind` là business semantics của value, không phải decoration. Caller không chọn
HeroUI variant, field colour hay raw `type`.

### `Input`

Chỉ dùng khi một contract khác đã thật sự giữ nhãn liên kết bằng `id`, hint/error và layout. Một màn
hình “trông như đã có heading” chưa đủ fact để bỏ `Field`; bare `Input` không phải bản rút gọn của
mọi form.

### Ba owner Search

- `SearchBox`: nhận query, submit và clear ngay tại toolbar/bar; query nằm trong chính field.
- `SearchCommandField`: field của global-search overlay; owner bên trên giữ value, active result,
  pending state và outcomes previous/next/submit.
- `PressableInputLike`: nút trên navbar mang hình dáng input để mở search; không nhận text.

### Kind và operation

Kind quyết định keyboard, autocomplete và secrecy; không tự thêm envelope/lock icon. Password reveal
hợp lệ vì `Input` sở hữu operation này và caller cung cấp hai accessible names
`revealLabel`/`hideLabel`.

### State

State không phải output thứ sáu. Nó chỉ bổ sung cho `Field`/`Input` đã phân loại: `isInvalid` luôn đi
với refusal copy, `disabled` nghĩa là tạm không khả dụng, còn `isLoading` giữ geometry. Public
`Field`/`Input` không có `readOnly` hoặc generic pending-validation state.

### `INSUFFICIENT CONTEXT`

Đây là kết quả bắt buộc khi business chưa nói job/search behavior/label owner, hoặc khi behavior cần
API chưa tồn tại. Safe stop ngăn AI biến sở thích hình thức thành variant và ngăn một wrapper tùy ý
trở thành “product component” giả.

## Exceptions

| Tình huống | Kết quả | Lý do dừng/route |
|---|---|---|
| Business chỉ nói “có ô search” | `INSUFFICIENT CONTEXT` | Chưa biết ô nhận query, điều khiển global results hay chỉ mở overlay |
| Business nói “input không có label” | `INSUFFICIENT CONTEXT` | Chưa có owner bảo đảm accessible name và message relationship |
| Currency/protocol prefix trong generic Input | `INSUFFICIENT CONTEXT` | Public Input chưa có value-context slot hoặc parser |
| Date picker | `INSUFFICIENT CONTEXT` | `date` không thuộc closed Input kind |
| Generic suffix hoặc action nằm trong well | `INSUFFICIENT CONTEXT` | Chưa có named owner, outcome và accessible name cho operation |
| Read-only field | `INSUFFICIENT CONTEXT` | Public `Field`/`Input` không có `readOnly`; display owner nằm ngoài canon này |
| Controlled ordinary field | `INSUFFICIENT CONTEXT` | Ordinary `Input` hiện uncontrolled; cần owner/API review |
| Pending username validation | `INSUFFICIENT CONTEXT` | Chưa có contract cho pending announcement, recovery và race behavior |
| “Đổi sang secondary/outline” | `INSUFFICIENT CONTEXT` | Variant nội bộ không phải business fact |

## Review Checklist

- [ ] Job là edit form value, search, open search hay chỉ đọc đã rõ chưa?
- [ ] Nếu là search: submit/clear, controlled results hay open overlay đã rõ chưa?
- [ ] Nếu là edit: nhãn/hint/error thuộc `Field` hay một named owner bên ngoài?
- [ ] Value là email, current password, new password, one-time code hay text?
- [ ] Invalid đã có refusal copy để `Field` announce chưa?
- [ ] Loading/disabled có đúng là state tạm của một owner đã phân loại chưa?
- [ ] Operation phụ có named owner, outcome và accessible name riêng chưa?
- [ ] Requested behavior có thật trong public API không?
- [ ] Nếu chỉ có appearance hoặc thiếu decisive fact, đã trả `INSUFFICIENT CONTEXT` chưa?
