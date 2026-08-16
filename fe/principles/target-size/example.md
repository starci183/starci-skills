---
id: fe-principles-target-size-example
title: example.md
slug: /fe/principles/target-size/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp và ngoại lệ của từng mã TARGET-N, viết bằng className thuần.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `target-size` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **mã đánh dấu thường với `className` thường**. Không thư viện thành phần, không thiết kế
hệ thống riêng, không khoá đăng ký. Một luật chỉ đúng khi nó đúng ở bất kỳ giao diện nào — nên nếu một
ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó sai chỗ.

Quy đổi dùng suốt trang này, theo thang khoảng cách mặc định `0.25rem` mỗi bậc:

| Bậc | CSS px | Vai trò |
|---|---|---|
| `11` | 44 | sàn của mô-đun |
| `12` | 48 | sàn Chất liệu |
| `6` | 24 | mức chặn tuân thủ |
| `2` | 8 | khoảng cách giữa các phần tử tối thiểu giữa hai vùng chạm |
| `2.5` | 10 | phần nới mỗi phía để đưa 24 lên 44 |
| `3.5` | 14 | phần nới mỗi phía để đưa 16 lên 44 |

Mỗi mã có **nhiều trường hợp**, rồi tới **ngoại lệ** và **những thứ trông giống nhưng không phải mã đó**.
Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một kết quả duy nhất.

---

## `TARGET-0` — không có gì nhận cú chạm

### Trường hợp: thẻ thống kê chỉ đọc

```tsx
<div className="rounded-lg border p-4">
  <p className="text-2xl font-semibold tabular-nums">86</p>
  <p className="text-sm text-neutral-500">bài đã hoàn thành</p>
</div>
```

### Trường hợp: ảnh đại diện và tên trong một hàng danh sách không bấm được

```tsx
<div className="flex items-center gap-2 p-4">
  <span className="grid size-10 place-items-center rounded-full bg-neutral-100 text-sm">AN</span>
  <span className="flex flex-col gap-1">
    <strong>Nguyễn Văn An</strong>
    <span className="text-sm text-neutral-500">Đã tham gia 2 tháng trước</span>
  </span>
</div>
```

Ảnh đại diện 40 px ở đây không phải một vi phạm. Nó không nhận cú chạm, nên nó không có sàn nào để vi phạm.

### Trường hợp: biểu tượng đứng trước một dòng chữ

```tsx
<p className="flex items-center gap-2 text-sm text-neutral-600">
  <svg aria-hidden="true" className="size-4 shrink-0" />
  Bài nộp sẽ được chấm trong vòng 24 giờ.
</p>
```

### Trường hợp: nhãn trạng thái trạng thái

```tsx
<span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
  <span className="size-1.5 rounded-full bg-emerald-600" />
  Đã thanh toán
</span>
```

### Ngoại lệ và nhầm lẫn

- **Cùng một hình vẽ, gắn hành vi vào là đổi mã ngay.** Không một điểm ảnh nào đổi, nhưng mã thì đổi:

  ```tsx
  {/* TARGET-0 */}
  <span className="grid size-10 place-items-center rounded-full bg-neutral-100 text-sm">AN</span>

  {/* TARGET-1 — hình vẽ giữ nguyên 40, vùng chạm phải lên 44 */}
  <button className="grid min-h-11 min-w-11 place-items-center" type="button">
    <span className="grid size-10 place-items-center rounded-full bg-neutral-100 text-sm">AN</span>
  </button>
  ```

- **`cursor-pointer` không biến một `div` thành mục tiêu hợp lệ**, và cũng không miễn cho nó cái sàn:

  ```tsx
  {/* SAI — nhận chuột nhưng không nhận bàn phím, và cao 32 */}
  <div className="h-8 cursor-pointer px-3" onClick={onOpen}>Mở</div>
  ```

- **Toàn thẻ bấm được thì thẻ mới là mục tiêu.** Chữ và số bên trong vẫn là `TARGET-0`; không ai phải
  đặt sàn cho từng dòng chữ bên trong một mục tiêu:

  ```tsx
  <button className="flex min-h-11 w-full flex-col gap-1 rounded-lg border p-4 text-left" type="button">
    <strong>Nền tảng hệ thống</strong>
    <span className="text-sm text-neutral-500">6 bài · 2 giờ</span>
  </button>
  ```

---

## `TARGET-1` — hình vẽ tự gánh sàn

### Trường hợp: nút chữ

```tsx
<button className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-neutral-900 px-4 text-sm text-white" type="submit">
  Lưu thay đổi
</button>
```

`min-h` chứ không phải `h`: nhãn dài xuống hai dòng thì nút phải cao lên, và một sàn không được biến
thành một trần.

### Trường hợp: nút chỉ có biểu tượng

```tsx
<button aria-label="Thông báo" className="grid min-h-11 min-w-11 place-items-center rounded-md" type="button">
  <svg aria-hidden="true" className="size-5" />
</button>
```

Hình dạng ký tự 20 px nằm giữa một vùng chạm 44 px là đúng. Người ta đo cái vùng, không đo cái hình dạng ký tự.

### Trường hợp: mục điều hướng trong thanh bên

```tsx
<nav className="flex flex-col">
  <a className="flex min-h-11 items-center gap-2 rounded-md px-3 text-sm" href="#courses">Khoá học</a>
  <a className="flex min-h-11 items-center gap-2 rounded-md px-3 text-sm" href="#progress">Tiến độ</a>
</nav>
```

### Trường hợp: nhãn bọc lấy hộp kiểm

```tsx
<label className="flex min-h-11 items-center gap-2 px-1 text-sm">
  <input className="size-4" type="checkbox" />
  Nhận email nhắc học mỗi tuần
</label>
```

Sàn đặt trên `label`, không đặt trên ô vuông 16 px. Vì `label` chuyển cú chạm sang ô nhập liệu, cả hàng là
một vùng chạm duy nhất — đây là `TARGET-1`, không phải `TARGET-2`, vì không có gì phải nới ra ngoài.

### Trường hợp: hàng danh sách bấm được

```tsx
<ul className="divide-y rounded-lg border">
  {items.map((item) => (
    <li key={item.id}>
      <button className="flex min-h-11 w-full items-center justify-between p-4 text-left" type="button">
        <span>{item.title}</span>
        <span className="text-sm text-neutral-500 tabular-nums">{item.count}</span>
      </button>
    </li>
  ))}
</ul>
```

### Trường hợp: thành phần điều khiển để nguyên cho trình duyệt

```tsx
<select className="rounded-md border text-sm" defaultValue="vi">
  <option value="vi">Tiếng Việt</option>
  <option value="en">English</option>
</select>
```

Không có class CSS kích thước nào, và điều đó **đúng**: ngoại lệ người dùng tác nhân đang có hiệu lực. Thêm
`h-9` vào là mất ngoại lệ và ăn ngay một lỗi.

### Ngoại lệ và nhầm lẫn

- **`h-9` cho "trông gọn hơn" là lỗi 36 px**, không phải một biến thể kích thước:

  ```tsx
  {/* SAI */}  <button className="h-9 rounded-md px-3 text-sm" type="button">Lọc</button>
  {/* ĐÚNG */} <button className="min-h-11 rounded-md px-4 text-sm" type="button">Lọc</button>
  ```

- **`size-11` chỉ dùng khi đúng là một ô vuông cố định.** Với thành phần điều khiển có chữ, nó vừa là sàn vừa là
  trần và sẽ cắt mất nhãn dài:

  ```tsx
  {/* SAI */}  <button className="size-11 px-4" type="button">Xác nhận đăng ký</button>
  ```

- **Bị vô hiệu hoá và đang tải giữ nguyên mã và nguyên số đo:**

  ```tsx
  <button className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-neutral-900 px-4 text-sm text-white disabled:opacity-50" disabled type="submit">
    Đang lưu…
  </button>
  ```

- **Khung chờ mang mã của thứ nó thay chỗ:**

  ```tsx
  <span className="block h-11 w-32 rounded-md bg-neutral-200" />
  ```

- **Đụng vào kích thước của thành phần điều khiển gốc là mất ngoại lệ người dùng tác nhân:**

  ```tsx
  {/* SAI — đã sửa kích thước thì phải tự gánh sàn */}
  <select className="h-8 appearance-none rounded-md border px-2 text-sm" />
  ```

---

## `TARGET-2` — nới vùng chạm, giữ nguyên hình vẽ

### Trường hợp: dấu X đóng phần tử chồng lớp, hình dạng ký tự 16 px

```tsx
<button
  aria-label="Đóng"
  className="relative grid size-4 place-items-center rounded after:absolute after:-inset-3.5 after:content-['']"
  type="button"
>
  <svg aria-hidden="true" className="size-4" />
</button>
```

16 + 14 + 14 = 44. Số nới không phải một hằng số quen tay; nó là hiệu giữa 44 và hình vẽ, chia đôi.

### Trường hợp: nút xoá trong một hàng dày 32 px

```tsx
<div className="flex h-8 items-center justify-between rounded-md border px-2">
  <span className="truncate text-sm">bao-cao-quy-4.pdf</span>
  <button
    aria-label="Xoá tệp"
    className="relative grid size-6 place-items-center rounded after:absolute after:-inset-2.5 after:content-['']"
    type="button"
  >
    <svg aria-hidden="true" className="size-4" />
  </button>
</div>
```

Hàng cao 32 nên vùng chạm 44 tràn lên trên và xuống dưới hàng. Đó là điều được phép — cái tràn ra là
vùng chạm, không phải hình vẽ, nên bố cục không biết chuyện gì vừa xảy ra.

### Trường hợp: dấu X trên nhãn nhỏ lọc

```tsx
<span className="inline-flex h-7 items-center gap-1 rounded-full border pl-3 pr-1 text-sm">
  Nền tảng
  <button
    aria-label="Bỏ lọc Nền tảng"
    className="relative grid size-5 place-items-center rounded-full after:absolute after:-inset-3 after:content-['']"
    type="button"
  >
    <svg aria-hidden="true" className="size-3" />
  </button>
</span>
```

### Trường hợp: nút hiện mật khẩu nằm trong ô nhập

```tsx
<div className="relative">
  <input className="min-h-11 w-full rounded-md border pl-3 pr-12" type="password" />
  <button
    aria-label="Hiện mật khẩu"
    className="absolute right-3 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded after:absolute after:-inset-3 after:content-['']"
    type="button"
  >
    <svg aria-hidden="true" className="size-5" />
  </button>
</div>
```

Ô nhập đã là `TARGET-1`. Nút bên trong nó là `TARGET-2`, và `pr-12` tồn tại để vùng chạm của nút
không nằm đè lên chỗ người dùng bấm để đặt con trỏ.

### Trường hợp lồng: hàng bấm được chứa một nút nhỏ bên trong

```tsx
<li className="relative flex min-h-11 items-center justify-between gap-7 p-4">
  <a className="min-w-0 flex-1 truncate text-sm after:absolute after:inset-0 after:content-['']" href="#thread">
    Phản hồi về bài nộp “Rate limiter”
  </a>
  <button
    aria-label="Lưu vào mục đã ghim"
    className="relative z-10 grid size-6 place-items-center rounded after:absolute after:-inset-2.5 after:content-['']"
    type="button"
  >
    <svg aria-hidden="true" className="size-4" />
  </button>
</li>
```

Hai mã lồng nhau: hàng là `TARGET-1` (liên kết phủ hết hàng bằng `after:inset-0`), nút ghim bên trong là
`TARGET-2`. `z-10` không phải để trang trí — thiếu nó thì vùng chạm phủ toàn hàng nằm đè lên vùng
chạm đã nới của nút, và người dùng bấm trúng nút nhưng mở trang khác. `gap-7` là `TARGET-3` giữa hai
vùng chạm này, tính ở phần sau.

### Ngoại lệ và nhầm lẫn

- **`-m-2.5 p-2.5` bị cấm.** Nó có nới vùng chạm thật, nhưng lề ngoài âm trừ thẳng vào `gap` của cha,
  nên nó đồng thời bóp khoảng cách giữa các phần tử mà `TARGET-3` vừa đặt ra:

  ```tsx
  {/* SAI */}  <button className="-m-2.5 grid size-6 place-items-center p-2.5" type="button" />
  {/* ĐÚNG */} <button className="relative grid size-6 place-items-center after:absolute after:-inset-2.5 after:content-['']" type="button" />
  ```

- **Thiếu `relative` là vùng nới bám nhầm gốc toạ độ**, và nó sẽ phủ lên một chỗ bất kỳ nào đó của
  trang:

  ```tsx
  {/* SAI */}  <button className="grid size-6 after:absolute after:-inset-2.5 after:content-['']" type="button" />
  ```

- **Thiếu `after:content-['']` là không có giả-phần tử nào được tạo ra.** Class CSS trông đủ, vùng
  chạm vẫn 24, và không có gì báo lỗi.

- **`overflow-hidden` ở tổ tiên cắt mất phần vừa nới ra:**

  ```tsx
  {/* SAI — bo góc bằng overflow-hidden, vùng chạm bị xén còn 24 ở mép */}
  <div className="overflow-hidden rounded-lg border">
    <button className="relative grid size-6 place-items-center after:absolute after:-inset-2.5 after:content-['']" type="button" />
  </div>
  ```

- **Không có ràng buộc thật thì đừng chọn mã này.** Nút đứng một mình trong phần tử chồng lớp thì cứ vẽ 44:

  ```tsx
  {/* SAI về mã — nới vô hình trong khi hoàn toàn được phép vẽ to */}
  <button className="relative grid size-6 place-items-center after:absolute after:-inset-2.5 after:content-['']" type="button" />
  {/* ĐÚNG */}
  <button className="grid min-h-11 min-w-11 place-items-center rounded-md" type="button" />
  ```

- **Nới rồi không được đổi vòng tiêu điểm.** Vòng vẫn vẽ trên hộp thật, vì người dùng bàn phím cần thấy
  đúng cái hình đang được chọn chứ không phải một khung to hơn nó:

  ```tsx
  <button className="relative grid size-6 place-items-center rounded outline-offset-2 after:absolute after:-inset-2.5 after:content-['']" type="button" />
  ```

---

## `TARGET-3` — khoảng cách giữa các phần tử giữa hai vùng chạm

### Trường hợp: hai nút, một trong hai khó hoàn tác

```tsx
<div className="flex items-center gap-2">
  <button className="min-h-11 rounded-md border px-4 text-sm" type="button">Huỷ</button>
  <button className="min-h-11 rounded-md bg-red-600 px-4 text-sm text-white" type="button">Xoá vĩnh viễn</button>
</div>
```

### Trường hợp: thanh công cụ biểu tượng 44, khoảng cách giữa các phần tử 8

```tsx
<div className="flex items-center gap-2">
  <button aria-label="Đậm" className="grid min-h-11 min-w-11 place-items-center rounded-md" type="button" />
  <button aria-label="Nghiêng" className="grid min-h-11 min-w-11 place-items-center rounded-md" type="button" />
  <button aria-label="Gạch chân" className="grid min-h-11 min-w-11 place-items-center rounded-md" type="button" />
</div>
```

### Trường hợp lồng: hai `TARGET-2` cạnh nhau — khoảng cách giữa các phần tử phải cộng phần nới

```tsx
<div className="flex items-center gap-7">
  <button
    aria-label="Sửa"
    className="relative grid size-6 place-items-center rounded after:absolute after:-inset-2.5 after:content-['']"
    type="button"
  />
  <button
    aria-label="Xoá"
    className="relative grid size-6 place-items-center rounded after:absolute after:-inset-2.5 after:content-['']"
    type="button"
  />
</div>
```

`gap-7` là 28 px giữa hai **hình vẽ**. Trừ 10 px nới của bên trái và 10 px nới của bên phải, còn đúng
8 px giữa hai **vùng chạm**. Viết `gap-2` ở đây là để hai vùng chạm chồng lên nhau 12 px, và cú chạm
rơi vào vùng chồng sẽ trúng phần tử nào là chuyện của thứ tự DOM chứ không còn là chuyện của thiết kế.

### Trường hợp: hai hình dạng ký tự 16 px cạnh nhau

```tsx
<div className="flex items-center gap-9">
  <button
    aria-label="Trang trước"
    className="relative grid size-4 place-items-center after:absolute after:-inset-3.5 after:content-['']"
    type="button"
  />
  <button
    aria-label="Trang sau"
    className="relative grid size-4 place-items-center after:absolute after:-inset-3.5 after:content-['']"
    type="button"
  />
</div>
```

14 + 14 + 8 = 36, tức `gap-9`. Hình vẽ càng nhỏ thì khoảng cách giữa các phần tử càng phải rộng — quan hệ ngược với trực giác
"biểu tượng bé thì xếp sát vào cho gọn", và đó là lý do trường hợp này phải nằm ở đây.

### Trường hợp: nhãn nhỏ lọc xuống dòng

```tsx
<div className="flex flex-wrap gap-2">
  <button className="min-h-11 rounded-full border px-4 text-sm" type="button">Tất cả</button>
  <button className="min-h-11 rounded-full border px-4 text-sm" type="button">Đang học</button>
  <button className="min-h-11 rounded-full border px-4 text-sm" type="button">Đã xong</button>
</div>
```

`gap-2` là khoảng cách giữa các phần tử theo cả hai trục. Khi nhãn nhỏ xuống dòng, hàng xóm mới nằm ở phía dưới, và cú chạm trượt
theo trục dọc cũng sai y như trượt theo trục ngang.

### Trường hợp ngoại lệ: mặt liền — bộ bước

```tsx
<div className="inline-flex items-center rounded-md border">
  <button aria-label="Giảm" className="grid min-h-11 min-w-11 place-items-center" type="button">−</button>
  <span className="min-w-11 text-center text-sm tabular-nums">3</span>
  <button aria-label="Tăng" className="grid min-h-11 min-w-11 place-items-center" type="button">+</button>
</div>
```

Không có class CSS khoảng cách giữa các phần tử, và đó là đúng: hai bên đều đủ 44 theo trục kề nhau, nên tâm của mỗi mục tiêu đã
cách khoảng cách giữa các phần tử 22 px.

### Trường hợp ngoại lệ: mặt liền — danh sách hàng xếp chồng

```tsx
<ul className="divide-y rounded-lg border">
  <li><button className="flex min-h-11 w-full items-center p-4 text-left" type="button">Thông báo qua email</button></li>
  <li><button className="flex min-h-11 w-full items-center p-4 text-left" type="button">Thông báo đẩy</button></li>
  <li><button className="flex min-h-11 w-full items-center p-4 text-left" type="button">Bản tin hằng tuần</button></li>
</ul>
```

### Ngoại lệ và nhầm lẫn

- **Khoảng cách giữa các phần tử đo giữa hai vùng chạm, không giữa hai hình vẽ.** Đây là nguồn gốc của gần như mọi lỗi
  `TARGET-3`.

- **Đừng lấy `gap` của bố cục làm khoảng cách giữa các phần tử.** Hai mô-đun trả lời hai câu hỏi khác nhau và cùng viết ra một
  class CSS; khi hai câu trả lời khác nhau thì lấy giá trị **lớn hơn**, không lấy giá trị của mô-đun viết
  sau:

  ```tsx
  {/* Quan hệ nội dung nói gap-2; hai vùng chạm đã nới nói 28 ⇒ lấy 28 */}
  <div className="flex items-center gap-7">…</div>
  ```

- **Khoảng cách giữa các phần tử không cứu được một mục tiêu thiếu cỡ.** Hai nút cao 32 px cách nhau 40 px vẫn là hai lỗi
  `TARGET-1`, chỉ là hai lỗi không đụng vào nhau.

- **Đường phân cách không phải khoảng cách giữa các phần tử.** Một đường kẻ 1 px cho mắt biết ranh giới ở đâu; ngón tay vẫn chạm được
  vào cả hai phía của nó.

---

## `TARGET-4` — mục tiêu nằm trong câu chữ

### Trường hợp: liên kết trong một câu

```tsx
<p className="text-sm leading-relaxed text-neutral-600">
  Bằng việc tạo tài khoản, bạn đồng ý với <a className="underline" href="#terms">điều khoản dịch vụ</a> và
  <a className="underline" href="#privacy"> chính sách riêng tư</a> của chúng tôi.
</p>
```

Hai liên kết cạnh nhau và không có khoảng cách giữa các phần tử nào giữa chúng. Chỗ chúng rơi xuống do ngắt dòng quyết định, nên
nghĩa vụ `TARGET-3` được treo.

### Trường hợp: chú thích đánh số

```tsx
<p className="text-sm leading-relaxed">
  Quorum write cần xét failure domain thay vì chỉ đếm node<a className="align-super text-xs underline" href="#fn-1">1</a>.
</p>
```

### Trường hợp: tên người trong một dòng hoạt động

```tsx
<li className="p-4 text-sm">
  <a className="font-medium underline" href="#u-an">An Nguyễn</a> đã nộp bài cho thử thách
  <a className="underline" href="#c-rate-limiter"> Rate limiter</a>.
</li>
```

### Ngoại lệ và nhầm lẫn

- **Đứng riêng một dòng thì không còn là nội tuyến.** Cùng một chữ, hai mã khác nhau:

  ```tsx
  {/* TARGET-4 */}
  <p className="text-sm">Tài liệu đầy đủ nằm ở <a className="underline" href="#docs">trang hướng dẫn</a>.</p>

  {/* TARGET-1 */}
  <a className="inline-flex min-h-11 items-center text-sm underline" href="#docs">Xem trang hướng dẫn</a>
  ```

- **Liên kết đứng một mình trong một ô bảng không phải nội tuyến.** Quanh nó không có chữ nào để nó nằm
  trong:

  ```tsx
  {/* SAI */}
  <td className="p-2"><a className="text-sm underline" href="#invoice">Tải hoá đơn</a></td>
  {/* ĐÚNG */}
  <td className="p-1"><a className="inline-flex min-h-11 items-center px-2 text-sm underline" href="#invoice">Tải hoá đơn</a></td>
  ```

- **Nhãn nhỏ, thẻ, đường dẫn phân cấp, mục trình đơn không phải nội tuyến.** Chúng nằm cạnh nhau, không nằm trong câu:

  ```tsx
  {/* SAI */}
  <div className="flex gap-1 text-sm">
    <a className="underline" href="#a">Khoá học</a><span>/</span><a className="underline" href="#b">Hệ thống</a>
  </div>
  {/* ĐÚNG */}
  <div className="flex items-center gap-2 text-sm">
    <a className="inline-flex min-h-11 items-center underline" href="#a">Khoá học</a>
    <span aria-hidden="true">/</span>
    <a className="inline-flex min-h-11 items-center underline" href="#b">Hệ thống</a>
  </div>
  ```

- **Đừng cố ép sàn vào liên kết nội tuyến.** Nó phá chính đoạn văn đã mua cho nó cái ngoại lệ:

  ```tsx
  {/* SAI */}
  <p>Đồng ý với <a className="inline-block min-h-11 underline" href="#terms">điều khoản</a>.</p>
  ```

---

## `TARGET-5` — vị trí chính là thông tin

### Trường hợp: ghim bản đồ và danh sách tương đương

```tsx
<div className="flex flex-col gap-4 lg:flex-row">
  <div className="relative min-h-80 flex-1 rounded-lg border">
    {venues.map((venue) => (
      <button
        aria-label={venue.name}
        className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-900"
        key={venue.id}
        style={{ left: `${venue.x}%`, top: `${venue.y}%` }}
        type="button"
      />
    ))}
  </div>
  <ul className="divide-y rounded-lg border lg:w-72">
    {venues.map((venue) => (
      <li key={venue.id}>
        <button className="flex min-h-11 w-full items-center justify-between p-4 text-left text-sm" type="button">
          {venue.name}
          <span className="text-neutral-500 tabular-nums">{venue.distance}</span>
        </button>
      </li>
    ))}
  </ul>
</div>
```

Cái danh sách bên phải không phải một tiện ích thêm vào; nó là điều kiện để ghim 12 px được phép tồn
tại. Xoá nó đi thì bản đồ này lập tức là một lỗi `TARGET-1` chưa sửa.

### Trường hợp: điểm dữ liệu trên biểu đồ và bảng số liệu

```tsx
<div className="flex flex-col gap-4">
  <svg className="h-48 w-full" role="img" aria-label="Điểm số theo tuần">
    {points.map((point) => (
      <circle cx={point.cx} cy={point.cy} key={point.week} r="4" tabIndex={0} />
    ))}
  </svg>
  <table className="w-full text-sm">
    <tbody className="divide-y">
      {points.map((point) => (
        <tr key={point.week}>
          <th className="p-1 text-left font-normal" scope="row">
            <button className="inline-flex min-h-11 items-center px-2" type="button">Tuần {point.week}</button>
          </th>
          <td className="p-3 text-right tabular-nums">{point.score}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

### Trường hợp: tay kéo đổi kích thước và ô nhập số đo

```tsx
<div className="flex flex-col gap-4">
  <div className="relative h-64 rounded-lg border">
    <div className="absolute inset-4 border-2 border-dashed" />
    <button
      aria-label="Kéo để đổi chiều rộng"
      className="absolute right-2 top-1/2 size-2 -translate-y-1/2 rounded-full bg-neutral-900"
      type="button"
    />
  </div>
  <label className="flex min-h-11 items-center gap-2 text-sm">
    Chiều rộng
    <input className="min-h-11 w-24 rounded-md border px-3 tabular-nums" inputMode="numeric" />
  </label>
</div>
```

### Ngoại lệ và nhầm lẫn

- **"Thanh công cụ chật quá" không phải mật độ bắt buộc.** Vị trí của nút thứ tám không mang thông tin gì
  cả; đó là `TARGET-1` chưa sửa, và cách sửa là bớt nút hoặc gom vào một trình đơn:

  ```tsx
  {/* SAI */}
  <div className="flex gap-1">
    {actions.map((action) => (
      <button className="grid size-7 place-items-center" key={action.id} type="button" />
    ))}
  </div>
  ```

- **Lịch tháng không phải `TARGET-5`.** Ô ngày lát kín mặt phẳng nên chúng được hưởng ngoại lệ mặt
  liền, và mỗi ô vẫn phải tự đủ cỡ:

  ```tsx
  <div className="grid grid-cols-7">
    {days.map((day) => (
      <button className="grid min-h-11 min-w-11 place-items-center text-sm tabular-nums" key={day.iso} type="button">
        {day.label}
      </button>
    ))}
  </div>
  ```

- **Không có thành phần điều khiển tương đương thì không có mã này.** Bản đồ với ghim 12 px và không có danh sách nào
  là một lỗi, không phải một ngoại lệ.

- **Đừng nới vùng chạm cho mục tiêu dày đặc.** Nới 10 px mỗi phía cho những ghim cách nhau 6 px là tạo
  ra một lớp vùng chạm chồng chéo mà không ai nhìn thấy để tránh:

  ```tsx
  {/* SAI */}
  <button className="absolute size-3 rounded-full after:absolute after:-inset-2.5 after:content-['']" type="button" />
  ```

---

## Ánh xạ yêu cầu sang một kết quả

Nêu phần tử, số đo hình vẽ, hàng xóm gần nhất và ràng buộc thật nếu có. Nếu thiếu **một** dữ kiện
quyết định, hỏi **một** câu cụ thể rồi dừng. Câu trả lời phải là một chuỗi class CSS hoặc một câu hỏi —
không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Thêm nút Lưu ở cuối biểu mẫu | Không có ràng buộc nào bắt nó nhỏ | `TARGET-1` | `min-h-11 min-w-11` |
| Thêm nút thông báo hình chuông trên phần đầu | Chỉ có biểu tượng nhưng vẫn được vẽ đủ cỡ | `TARGET-1` | `grid min-h-11 min-w-11 place-items-center` |
| Thêm dấu X đóng ở góc phần tử chồng lớp, hình dạng ký tự 16 | Hình vẽ bị ràng buộc, còn chỗ để nới | `TARGET-2` | `relative after:absolute after:-inset-3.5 after:content-['']` |
| Thêm nút xoá cuối mỗi hàng trong bảng dày | Hàng cao 32, không nới hàng ra được | `TARGET-2` | `relative after:absolute after:-inset-2.5 after:content-['']` |
| Xếp Huỷ cạnh Xoá vĩnh viễn | Hai vùng chạm 44 kề nhau, cần khoảng cách giữa các phần tử tối thiểu | `TARGET-3` | `gap-2` |
| Xếp hai nút biểu tượng 24 đã nới cạnh nhau | Khoảng cách giữa các phần tử đo trên vùng chạm: 10 + 10 + 8 | `TARGET-3` | `gap-7` |
| Dựng cụm tăng giảm số lượng dính liền | Hai bên đều đủ 44 theo trục kề nhau | `TARGET-3` | không class CSS khoảng cách giữa các phần tử |
| Chèn liên kết điều khoản vào câu đồng ý | Nằm trong dòng chảy của câu | `TARGET-4` | không class CSS kích thước |
| Đặt "Xem thêm" dưới đoạn mô tả | Đứng riêng, không nằm trong câu | `TARGET-1` | `inline-flex min-h-11 items-center` |
| Hiện ảnh đại diện người bình luận | Không nhận cú chạm | `TARGET-0` | không class CSS kích thước |
| Cho bấm vào ảnh đại diện để mở hồ sơ | Đã nhận cú chạm, hình vẽ giữ 40 | `TARGET-2` | `relative after:absolute after:-inset-0.5 after:content-['']` |
| Vẽ ghim lên bản đồ theo toạ độ, kèm danh sách địa điểm | Toạ độ là thông tin, đã có tương đương | `TARGET-5` | không class CSS trên ghim |
| Vẽ ghim lên bản đồ, không có gì khác | Mật độ bắt buộc nhưng thiếu tương đương | `TARGET-1` | chưa đạt — trả lại yêu cầu |

Dòng cuối là câu trả lời hợp lệ duy nhất cho yêu cầu đó. Một mã không tự sinh ra từ chỗ thiếu điều
kiện của nó.

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `TARGET-0` / mọi mã khác | Bấm đúng vào giữa nó thì có chuyện gì xảy ra không? |
| `TARGET-1` / `TARGET-2` | Vẽ nó thành 44 thì có thứ gì khác phải vẽ lại không? |
| `TARGET-1` / `TARGET-4` | Bỏ nó ra thì phần chữ còn lại có còn là một câu hoàn chỉnh không? |
| `TARGET-2` / `TARGET-5` | Nới 44 quanh nó có chồng lên vùng chạm của hàng xóm không? |
| `TARGET-2` / `TARGET-3` | Con số đang đo là hình vẽ hay là vùng chạm? |
| `TARGET-5` / `TARGET-1` chưa sửa | Dời nó ra chỗ dễ bấm hơn thì có thông tin nào thành sai không? |
| `TARGET-5` có hiệu lực / không | Thành phần điều khiển tương đương đủ cỡ có thật sự nằm trên màn hình này không? |
| `TARGET-3` / ngoại lệ mặt liền | Cả hai bên có đủ 44 theo đúng trục chúng kề nhau không? |

## Sai lầm lặp lại nhiều nhất

1. Đo trên hình vẽ hoặc trên hình dạng ký tự thay vì trên vùng chạm.
2. `h-9` hoặc `h-10` cho "trông gọn" — 36 và 40 đều dưới sàn.
3. Nới vùng chạm bằng `-m-* p-*`, làm khoảng cách giữa các phần tử bị bóp lại mà không ai thấy.
4. Quên `relative`, hoặc quên `after:content-['']`, nên phần nới không tồn tại và cũng không báo lỗi.
5. `overflow-hidden` ở tổ tiên xén mất phần vùng chạm vừa nới.
6. Đặt `gap-2` giữa hai vùng chạm đã nới, khiến chúng chồng lên nhau.
7. Coi biểu tượng nhỏ hơn là được xếp sát hơn, trong khi quan hệ đúng là ngược lại.
8. Gọi mọi chỗ chật là "mật độ bắt buộc" để khỏi phải sửa.
9. Dùng `TARGET-5` mà không dựng thành phần điều khiển tương đương.
10. Hạ sàn trên thiết bị di động, đúng nơi thiết bị chạm là thiết bị duy nhất.
11. Khung chờ hoặc trạng thái đang tải có kích thước khác thành phần điều khiển thật.
12. Coi `cursor-pointer` là bằng chứng rằng thứ đó đã là một mục tiêu hợp lệ.
