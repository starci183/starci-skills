---
id: fe-principles-radius-example
title: example.md
slug: /fe/principles/radius/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp và ngoại lệ của từng mã RADIUS-N, viết bằng className thuần.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `radius` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **mã đánh dấu thường với `className` thường**. Không thư viện thành phần, không thiết kế
hệ thống riêng, không khoá đăng ký. Một luật chỉ đúng khi nó đúng ở bất kỳ giao diện nào — nên nếu một
ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó sai chỗ.

Mỗi mã có **nhiều trường hợp**, rồi tới **ngoại lệ** và **những thứ trông giống nhưng không phải mã đó**.
Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một class CSS duy nhất.

Số dùng trong mọi phép trừ dưới đây: `rounded-xl` = 12px · `rounded-lg` = 8px · `rounded-md` = 6px ·
`rounded` = 4px · `rounded-sm` = 2px · `p-1` = 4px · `p-1.5` = 6px · `p-2` = 8px · `p-2.5` = 10px ·
`p-3` = 12px · `p-4` = 16px.

---

## `RADIUS-0` — không mang góc nào

### Trường hợp: hộp xếp trong suốt, không vẽ ranh giới

```tsx
<div className="flex flex-col gap-3">
  <h2 className="font-medium">Khoá học của tôi</h2>
  <div className="rounded-xl border p-4">…</div>
</div>
```

Cái `div` ngoài không có nền, không viền, không cắt xén. Nó không phải ranh giới, nên nó không có gì để
bo — và cũng không có gì để **từ chối** bo.

### Trường hợp: ô trong bảng dữ liệu

```tsx
<table className="w-full">
  <tbody>
    <tr className="border-b">
      <td className="px-3 py-2 text-sm">Nền tảng hệ thống</td>
      <td className="px-3 py-2 text-sm tabular-nums">6</td>
    </tr>
  </tbody>
</table>
```

### Trường hợp: hàng nằm trong cha đã cắt xén — cha bo, con để trơn

```tsx
<ul className="divide-y overflow-hidden rounded-xl border">
  <li className="p-4">Thông báo qua email</li>
  <li className="p-4">Thông báo đẩy</li>
  <li className="p-4">Bản tin hằng tuần</li>
</ul>
```

Hàng đầu và hàng cuối **hiện ra** có góc bo, nhưng chúng không **khai** bán kính nào. Cha sở hữu góc và
cha cắt. Đây là lời giải chuẩn cho khoảng cách bằng 0.

### Trường hợp: dải chạy hết chiều ngang màn hình — ranh giới thật, từ chối bo

```tsx
<div className="rounded-none bg-amber-50 px-4 py-3 text-sm text-amber-900">
  Hệ thống sẽ bảo trì lúc 02:00 ngày mai.
</div>
```

Có nền, có khoảng đệm trong, là một mặt phẳng thật. Nhưng nó chạm cả hai mép màn hình nên hai góc trái không
tồn tại, và bo hai góc phải một mình sẽ vô nghĩa. `rounded-none` viết ra để người đọc thấy quyết định
đã được **lấy**, không phải bị **quên**.

### Trường hợp: khung trở thành tràn toàn chiều rộng ở thiết bị di động

```tsx
<section className="rounded-none border-y p-4 sm:rounded-xl sm:border">
  <h3 className="font-medium">Tóm tắt thanh toán</h3>
</section>
```

Ở thiết bị di động ranh giới **thật sự đổi**: từ một tấm nổi trên nền trang thành một dải chạy hết bề ngang.
Đây là lần duy nhất bán kính được phép đổi theo khung nhìn, và nó đổi vì ranh giới đổi chứ không vì màn
hình hẹp.

### Ngoại lệ và nhầm lẫn

- **Đừng viết `rounded-none` lên một hộp xếp.** Ở đó không có ranh giới nào để từ chối.

  ```tsx
  {/* SAI */}  <div className="flex flex-col gap-3 rounded-none">…</div>
  {/* ĐÚNG */} <div className="flex flex-col gap-3">…</div>
  ```

- **Đừng bo từng hàng rồi lại bo cha.** Cùng một góc khai hai lần, và hai lần đó sẽ lệch nhau.

  ```tsx
  {/* SAI */}
  <ul className="divide-y rounded-xl border">
    <li className="rounded-xl p-4">Thông báo qua email</li>
    <li className="rounded-xl p-4">Thông báo đẩy</li>
  </ul>
  ```

- **Đừng dùng `rounded-none` để "đặt lại".** Nếu phần tử chưa từng có bán kính, không có gì để đặt lại;
  nếu nó nhận bán kính từ một class CSS chung thì `rounded-none` là đúng, và đó chính là trường hợp thứ
  hai của mã này.

---

## `RADIUS-1` — bậc thành phần điều khiển

### Trường hợp: nút chính và nút phụ

```tsx
<div className="flex items-center gap-2">
  <button className="rounded-md border px-3 py-2 text-sm" type="button">Xem trước</button>
  <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="submit">Lưu</button>
</div>
```

### Trường hợp: ô nhập và textarea

```tsx
<div className="flex flex-col gap-3">
  <label className="text-sm font-medium" htmlFor="title">Tiêu đề</label>
  <input className="rounded-md border px-3 py-2" id="title" />
  <textarea className="min-h-32 rounded-md border p-3" />
</div>
```

### Trường hợp: nút biểu tượng vuông

```tsx
<button aria-label="Tuỳ chọn" className="grid size-9 place-items-center rounded-md border" type="button">
  <svg aria-hidden="true" className="size-4" />
</button>
```

Vuông và nhỏ, nhưng **không** tròn: nó là hình chữ nhật được bo, nên `RADIUS-1`, không phải `RADIUS-3`.

### Trường hợp: phần tử trong trình đơn thả xuống — **trông như `RADIUS-1` nhưng không phải**

```tsx
<div className="rounded-xl border bg-white p-1 shadow-lg">
  <button className="w-full rounded-lg px-3 py-2 text-left text-sm" type="button">Đổi tên</button>
  <button className="w-full rounded-lg px-3 py-2 text-left text-sm" type="button">Nhân bản</button>
</div>
```

Chú ý: hai phần tử **không** phải `rounded-md`. Chúng nằm trong một bề mặt `rounded-xl` cách 4px, nên
chúng là `RADIUS-4`: `12 − 4 = 8` ⇒ `rounded-lg`. Đây là chỗ `RADIUS-4` thắng `RADIUS-1` rõ nhất, và
cũng là chỗ bị làm sai nhiều nhất.

### Trường hợp: thẻ vuông

```tsx
<span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs">Hệ phân tán</span>
```

### Trường hợp: thẻ ngày trong lịch

```tsx
<div className="grid grid-cols-7 gap-1">
  {days.map((day) => (
    <button className="rounded-md py-2 text-sm tabular-nums" key={day} type="button">{day}</button>
  ))}
</div>
```

### Trường hợp: ô nhập mã xác thực

```tsx
<div className="flex items-center gap-2">
  <input className="size-11 rounded-md border text-center text-lg tabular-nums" maxLength={1} />
  <input className="size-11 rounded-md border text-center text-lg tabular-nums" maxLength={1} />
  <input className="size-11 rounded-md border text-center text-lg tabular-nums" maxLength={1} />
</div>
```

### Ngoại lệ và nhầm lẫn

- **Nút viên nhộng là `RADIUS-3`, không phải `RADIUS-1`.** Và trong cùng một màn, đừng trộn hai kiểu
  cho cùng một hạng nút:

  ```tsx
  {/* SAI — hai nút cùng hạng, hai danh tính hình học khác nhau */}
  <div className="flex items-center gap-2">
    <button className="rounded-md border px-3 py-2 text-sm" type="button">Huỷ</button>
    <button className="rounded-full bg-neutral-900 px-4 py-2 text-sm text-white" type="submit">Xác nhận</button>
  </div>
  ```

- **Nút rất rộng vẫn là thành phần điều khiển.** Kích thước không nâng mã:

  ```tsx
  <button className="w-full rounded-md bg-neutral-900 px-3 py-2.5 text-sm text-white" type="submit">
    Bắt đầu học
  </button>
  ```

- **Đừng bo thành phần điều khiển to hơn bề mặt chứa nó.** Nếu một nút `rounded-xl` nằm trong một thẻ
  `rounded-xl`, hai cung có cùng bán kính ở hai khoảng cách khác nhau — đúng định nghĩa con dấu dán.

- **Trạng thái không đổi bán kính:**

  ```tsx
  {/* SAI */}  <button className="rounded-md hover:rounded-lg" type="button">Lưu</button>
  ```

---

## `RADIUS-2` — bậc bề mặt

### Trường hợp: thẻ nội dung

```tsx
<article className="flex flex-col gap-3 rounded-xl border p-4">
  <h3 className="font-medium">Thiết kế hệ thống nâng cao</h3>
  <p className="text-sm text-neutral-500">20 bài · 8 thử thách</p>
</article>
```

### Trường hợp: hộp thoại xác nhận

```tsx
<div className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow-xl">
  <h2 className="font-medium">Xoá bản nháp?</h2>
  <p className="text-sm text-neutral-500">Hành động này không thể hoàn tác.</p>
  <div className="flex items-center justify-end gap-2">
    <button className="rounded-md border px-3 py-2 text-sm" type="button">Huỷ</button>
    <button className="rounded-md bg-red-600 px-3 py-2 text-sm text-white" type="button">Xoá</button>
  </div>
</div>
```

Hộp thoại `p-6` = 24px, lớn hơn 12px, nên đồng tâm **không** ràng buộc: hai nút bên trong tự do và lấy
`RADIUS-1`. Nếu khoảng đệm trong là `p-2` thì hai nút đó đã phải là `RADIUS-4`.

### Trường hợp: cửa sổ nổi nổi

```tsx
<div className="w-72 rounded-xl border bg-white p-4 shadow-lg">
  <p className="text-sm">Bạn còn 3 lượt nộp bài trong hôm nay.</p>
</div>
```

### Trường hợp: khối nhấn mạnh cảnh báo

```tsx
<div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
  Bài nộp chưa chạy qua bộ kiểm tra tự động.
</div>
```

### Trường hợp: khối mã

```tsx
<pre className="overflow-x-auto rounded-xl bg-neutral-900 p-4 text-sm text-neutral-100">
  <code>{snippet}</code>
</pre>
```

### Trường hợp: trạng thái rỗng

```tsx
<div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center">
  <p className="text-sm text-neutral-500">Chưa có bài nộp nào.</p>
  <button className="rounded-md border px-3 py-2 text-sm" type="button">Tạo bài nộp</button>
</div>
```

### Trường hợp: ảnh thu nhỏ đứng riêng, không nằm trong khung nào

```tsx
<img alt="" className="aspect-video w-full rounded-xl object-cover" src={cover} />
```

### Ngoại lệ và nhầm lẫn

- **To hơn không tròn hơn.** Hộp thoại và thẻ cùng là bề mặt ⇒ cùng bậc:

  ```tsx
  {/* SAI */}  <div className="rounded-3xl bg-white p-6 shadow-xl">…dialog…</div>
  {/* ĐÚNG */} <div className="rounded-xl bg-white p-6 shadow-xl">…dialog…</div>
  ```

- **Bề mặt lồng bề mặt với khoảng cách mỏng ⇒ `RADIUS-4`:**

  ```tsx
  {/* SAI — con dấu dán */}
  <div className="rounded-xl border p-1">
    <div className="rounded-xl bg-neutral-50 p-3">…</div>
  </div>

  {/* ĐÚNG — 12 − 4 = 8 */}
  <div className="rounded-xl border p-1">
    <div className="rounded-lg bg-neutral-50 p-3">…</div>
  </div>
  ```

- **Đừng dùng giá trị tự chế cho một bề mặt "hơi khác":**

  ```tsx
  {/* SAI */}  <div className="rounded-[14px] border p-4">…</div>
  ```

- **Đừng dùng bán kính để nói "đây là thứ quan trọng".** Nhấn mạnh là việc của nền, viền và thứ bậc
  chữ; bán kính chỉ nói phần tử này là **loại ranh giới nào**.

---

## `RADIUS-3` — bản thân hình là tròn

### Trường hợp: ảnh đại diện

```tsx
<span className="grid size-10 place-items-center rounded-full bg-neutral-100 text-sm">AN</span>
```

### Trường hợp: nhãn trạng thái đếm

```tsx
<span className="grid min-w-5 place-items-center rounded-full bg-red-600 px-1.5 text-xs text-white">
  12
</span>
```

### Trường hợp: nhãn bo tròn lọc

```tsx
<div className="flex flex-wrap items-center gap-2">
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Tất cả</button>
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Đang học</button>
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Đã xong</button>
</div>
```

### Trường hợp: rãnh và lấp đầy của thanh tiến độ — hai `RADIUS-3` lồng nhau

```tsx
<div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
  <div className="h-full w-2/3 rounded-full bg-neutral-900" />
</div>
```

Lấp đầy nằm trong rãnh nhưng **không** suy ra gì cả: viên nhộng miễn trừ phép trừ. Ở đây khoảng cách
cũng bằng 0, nên rãnh cắt xén — đúng cả hai luật cùng lúc.

### Trường hợp: công tắc và nút gạt

```tsx
<button aria-pressed="true" className="flex h-6 w-11 items-center rounded-full bg-neutral-900 p-0.5" type="button">
  <span className="size-5 translate-x-5 rounded-full bg-white" />
</button>
```

Nút gạt là hình tròn, không phải "hình chữ nhật bo 10px". Nó không lấy `p-0.5` để trừ ra bán kính nào.

### Trường hợp: chấm trạng thái và biểu tượng đang tải

```tsx
<span className="flex items-center gap-2 text-sm">
  <span className="size-2 rounded-full bg-emerald-500" />
  Đang hoạt động
</span>
```

```tsx
<span aria-label="Đang tải" className="size-5 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900" role="status" />
```

### Ngoại lệ và nhầm lẫn

- **Ảnh đại diện trong thẻ không suy ra gì:**

  ```tsx
  <div className="flex items-center gap-2 rounded-xl border p-1.5">
    <span className="grid size-10 place-items-center rounded-full bg-neutral-100 text-sm">AN</span>
    <span className="text-sm font-medium">Nguyễn Văn An</span>
  </div>
  ```

  Thẻ `p-1.5` gợi ý `12 − 6 = 6` cho hộp trong, nhưng ảnh đại diện không phải hộp có góc, nên `rounded-full`
  đứng nguyên.

- **Đừng dùng `rounded-full` cho hộp có nội dung dài.** Khi chữ dài ra, cung hai đầu cắn vào chữ và
  phải bù khoảng đệm trong ngang bất thường:

  ```tsx
  {/* SAI */}  <div className="rounded-full border p-4">Một đoạn mô tả dài hai ba dòng…</div>
  ```

- **Đừng dùng `rounded-full` để làm một thẻ nhỏ "mềm hơn".** Đó là đổi danh tính hình học, không phải
  đổi sắc thái.

---

## `RADIUS-4` — góc trong nằm trong cung góc ngoài

Đây là mã chịu lực. Mọi ví dụ dưới đây đều kèm phép trừ, vì **phép trừ chính là bằng chứng**.

### Trường hợp: ảnh tràn trong thẻ có khoảng đệm trong mỏng — `12 − 4 = 8`

```tsx
<article className="rounded-xl border p-1">
  <img alt="" className="aspect-video w-full rounded-lg object-cover" src={cover} />
  <div className="flex flex-col gap-1 p-3">
    <h3 className="font-medium">Thiết kế hệ thống nâng cao</h3>
    <p className="text-sm text-neutral-500">20 bài</p>
  </div>
</article>
```

### Trường hợp: khối "well" tóm tắt trong thẻ — `12 − 6 = 6`

```tsx
<section className="flex flex-col gap-3 rounded-xl border p-1.5">
  <div className="rounded-md bg-neutral-50 p-3">
    <span className="text-sm text-neutral-500">Tổng cộng</span>
    <p className="text-xl font-semibold tabular-nums">1.498.000đ</p>
  </div>
</section>
```

Kết quả là `rounded-md`, trùng chuỗi với bậc thành phần điều khiển. Nó vẫn là `RADIUS-4`, vì nó **ra từ phép trừ**:
đổi `p-1.5` thành `p-1` thì nó phải thành `rounded-lg`, còn một `rounded-md` chọn tay thì sẽ nằm im và
sai.

### Trường hợp: ô nhập nằm sát trong một khung — `12 − 8 = 4`

```tsx
<div className="rounded-xl border bg-neutral-50 p-2">
  <input aria-label="Tìm kiếm" className="w-full rounded border bg-white px-3 py-2 text-sm" />
</div>
```

### Trường hợp: mép rất mỏng — `12 − 10 = 2`

```tsx
<div className="rounded-xl bg-neutral-900 p-2.5">
  <div className="rounded-sm bg-white p-4 text-sm">…nội dung nổi trên khung tối…</div>
</div>
```

### Trường hợp: cha có đường viền, đường viền tính vào khoảng cách — `12 − (4 + 2) = 6`

```tsx
<div className="rounded-xl border-2 border-neutral-900 p-1">
  <img alt="" className="aspect-square w-full rounded-md object-cover" src={photo} />
</div>
```

Nếu chỉ trừ khoảng đệm trong sẽ ra `rounded-lg`, và cung trong sẽ cắt cung ngoài đúng 2px — vừa đủ để góc trông
"phồng" mà không ai chỉ ra được tại sao.

### Trường hợp: khoảng cách bằng hoặc lớn hơn bán kính ngoài ⇒ hết ràng buộc

```tsx
<article className="flex flex-col gap-4 rounded-xl border p-4">
  <img alt="" className="aspect-video w-full rounded-xl object-cover" src={cover} />
  <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="button">Vào học</button>
</article>
```

`p-4` = 16px > 12px: góc của ảnh đã ra khỏi cung của thẻ, hai đường cong không nhìn thấy nhau nữa.
Ảnh là bề mặt đứng riêng ⇒ `RADIUS-2`; nút là thành phần điều khiển ⇒ `RADIUS-1`. Không có phép trừ nào ở đây.

### Trường hợp: ba tầng lồng nhau — `12 → 8 → 4`

```tsx
<section className="rounded-xl border p-1">
  <div className="rounded-lg bg-neutral-50 p-1">
    <div className="rounded bg-white p-3 text-sm">…nội dung trong cùng…</div>
  </div>
</section>
```

Mỗi tầng trừ đi đúng khoảng cách của tầng đó. Ba cung song song, và không tầng nào cần ai đoán.

### Trường hợp: hàng đang chọn trong trình đơn — `12 − 4 = 8`

```tsx
<div className="w-56 rounded-xl border bg-white p-1 shadow-lg">
  <button className="w-full rounded-lg bg-neutral-100 px-3 py-2 text-left text-sm" type="button">Tổng quan</button>
  <button className="w-full rounded-lg px-3 py-2 text-left text-sm" type="button">Hoạt động</button>
  <button className="w-full rounded-lg px-3 py-2 text-left text-sm" type="button">Cài đặt</button>
</div>
```

Nền chỉ hiện ở hàng được chọn, nhưng **cả ba** hàng khai cùng một bán kính. Bán kính thuộc về ranh
giới, không thuộc về trạng thái; nếu chỉ hàng được chọn mới có class CSS thì rê chuột sẽ vẽ ra một hình khác.

### Trường hợp: ảnh thu nhỏ trong danh sách-phần tử — `12 − 8 = 4`

```tsx
<li className="flex items-center gap-3 rounded-xl border p-2">
  <img alt="" className="size-12 rounded object-cover" src={thumb} />
  <span className="flex flex-col gap-1">
    <strong className="text-sm">Đọc và ghi theo cơ chế quorum</strong>
    <span className="text-xs text-neutral-500">12 phút</span>
  </span>
</li>
```

### Trường hợp: `RADIUS-4` lồng trong `RADIUS-2`, và bên trong lại có `RADIUS-1` tự do

```tsx
<section className="flex flex-col gap-4 rounded-xl border p-1.5">
  <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-4">
    <h3 className="font-medium">Xác nhận ghi danh</h3>
    <input aria-label="Mã giảm giá" className="w-full rounded-md border bg-white px-3 py-2 text-sm" />
  </div>
</section>
```

Ba quyết định, ba lý do khác nhau: thẻ ngoài là `RADIUS-2`; khối xám là `RADIUS-4` với `12 − 6 = 6`;
ô nhập nằm trong khối xám cách `p-4` = 16px > 6px nên **hết ràng buộc**, quay về `RADIUS-1`.

### Ngoại lệ và nhầm lẫn

- **Con dấu dán — giữ nguyên bán kính ngoài:**

  ```tsx
  {/* SAI */}
  <div className="rounded-xl border p-1">
    <img alt="" className="w-full rounded-xl object-cover" src={cover} />
  </div>
  ```

- **Làm tròn lên là sai; làm tròn xuống là luật.** `12 − 5 = 7` không có bậc nào, lấy `rounded-md`
  (6px), không lấy `rounded-lg` (8px):

  ```tsx
  {/* ĐÚNG — border 1px + p-1 = 5 ⇒ 7 ⇒ lấy bậc dưới */}
  <div className="rounded-xl border p-1">
    <img alt="" className="w-full rounded-md object-cover" src={cover} />
  </div>
  ```

- **Khoảng cách bằng 0 thì không phải phép trừ, mà là cắt xén:**

  ```tsx
  {/* SAI — hai phần tử cùng bo một góc */}
  <div className="rounded-xl border">
    <img alt="" className="w-full rounded-xl object-cover" src={cover} />
  </div>

  {/* ĐÚNG — cha clip, con để trơn */}
  <div className="overflow-hidden rounded-xl border">
    <img alt="" className="w-full object-cover" src={cover} />
  </div>
  ```

- **Đừng suy ra từ một cha không có bán kính.** Một hộp xếp trong suốt không cấp gì cho ai; con của nó
  tự chọn mã bậc.

- **Đừng đo bằng ảnh chụp.** Khoảng cách phải đọc ra từ class CSS khoảng đệm trong và đường viền thật; một con số
  ước lượng sẽ ra một bậc lệch và không ai truy được vì sao.

---

## `RADIUS-5` — không phải cả bốn góc đều tự do

### Trường hợp: dưới bảng trượt neo đáy màn hình

```tsx
<div className="fixed inset-x-0 bottom-0 flex flex-col gap-4 rounded-t-xl bg-white p-6 shadow-xl">
  <h2 className="font-medium">Chọn phương thức thanh toán</h2>
</div>
```

Hai góc dưới chạy ra khỏi màn hình nên không tồn tại. Hai góc trên vẫn là **bậc bề mặt**, không to
hơn: bị cắt không làm một mặt phẳng tròn hơn.

### Trường hợp: ngăn trượt trượt từ cạnh phải

```tsx
<aside className="fixed inset-y-0 right-0 w-80 rounded-l-xl bg-white p-6 shadow-xl">
  <h2 className="font-medium">Bộ lọc</h2>
</aside>
```

### Trường hợp: nhóm nút phân đoạn ghép sát

```tsx
<div className="inline-flex overflow-hidden rounded-md border">
  <button className="border-r px-3 py-1.5 text-sm" type="button">Ngày</button>
  <button className="border-r px-3 py-1.5 text-sm" type="button">Tuần</button>
  <button className="px-3 py-1.5 text-sm" type="button">Tháng</button>
</div>
```

Khi cha cắt xén được thì cắt xén: từng phân đoạn ở `RADIUS-0`, và không ai phải nhớ phân đoạn nào là đầu, phân đoạn
nào là cuối.

### Trường hợp: cụm xếp dọc ghép mà cha không cắt xén được — dùng `first:` / `last:`

```tsx
<div className="flex flex-col">
  <button className="border px-3 py-2 text-left text-sm first:rounded-t-md" type="button">Xuất PDF</button>
  <button className="border-x px-3 py-2 text-left text-sm" type="button">Xuất CSV</button>
  <button className="border px-3 py-2 text-left text-sm last:rounded-b-md" type="button">Sao chép liên kết</button>
</div>
```

Dùng khi bóng đổ hoặc một phần tử tràn ra ngoài khiến `overflow-hidden` cắt mất thứ cần thấy. Đây là
lý do duy nhất để chọn dạng này thay vì cắt xén.

### Trường hợp: ảnh bìa trên đầu thẻ không khoảng đệm trong — `RADIUS-5` với độ lớn của bậc bề mặt

```tsx
<article className="flex flex-col overflow-hidden rounded-xl border">
  <img alt="" className="aspect-video w-full object-cover" src={cover} />
  <div className="flex flex-col gap-1 p-4">
    <h3 className="font-medium">Nhập môn hệ phân tán</h3>
    <p className="text-sm text-neutral-500">12 bài</p>
  </div>
</article>
```

Ở đây cắt xén giải quyết xong, nên ảnh ở `RADIUS-0`. Chỉ khi thẻ **không thể** cắt xén mới phải viết ra
`RADIUS-5`:

```tsx
<article className="flex flex-col rounded-xl border">
  <img alt="" className="aspect-video w-full rounded-t-xl object-cover" src={cover} />
  <div className="flex flex-col gap-1 p-4">…</div>
</article>
```

### Trường hợp: `RADIUS-5` chồng `RADIUS-4` — góc nào do `5`, tròn bao nhiêu do `4`

```tsx
<article className="rounded-xl border p-1">
  <img alt="" className="aspect-video w-full rounded-t-lg object-cover" src={cover} />
  <div className="flex flex-col gap-1 p-3">
    <h3 className="font-medium">Kiến trúc sự kiện</h3>
  </div>
</article>
```

Ảnh chỉ tràn ngang, mép dưới của nó dính vào phần chữ nên hai góc dưới không tồn tại. Độ lớn hai góc
trên vẫn là `12 − 4 = 8`.

### Trường hợp: thanh tìm kiếm dính với nút bên cạnh

```tsx
<div className="flex">
  <input aria-label="Tìm kiếm" className="min-w-0 flex-1 rounded-l-md border px-3 py-2 text-sm" />
  <button className="rounded-r-md border border-l-0 bg-neutral-900 px-4 text-sm text-white" type="button">
    Tìm
  </button>
</div>
```

### Trường hợp: thẻ tab đang chọn bo hai góc trên

```tsx
<div className="flex items-end gap-1 border-b" role="tablist">
  <button className="rounded-t-md border border-b-0 px-3 py-2 text-sm" role="tab" type="button">Tổng quan</button>
  <button className="px-3 py-2 text-sm text-neutral-500" role="tab" type="button">Hoạt động</button>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Cả bốn góc tự do thì đừng dùng dạng theo cạnh:**

  ```tsx
  {/* SAI */}  <div className="rounded-t-xl rounded-b-xl border p-4">…</div>
  {/* ĐÚNG */} <div className="rounded-xl border p-4">…</div>
  ```

- **Đừng bo cả bốn góc rồi cắt bằng `overflow-hidden`.** Hai lời khai cho một hình:

  ```tsx
  {/* SAI */}
  <div className="fixed inset-x-0 bottom-0 overflow-hidden rounded-xl bg-white p-6">…</div>
  ```

- **Bị cắt không đổi độ lớn:**

  ```tsx
  {/* SAI — sheet tự nâng bậc vì "nhìn cho ra sheet" */}
  <div className="fixed inset-x-0 bottom-0 rounded-t-3xl bg-white p-6">…</div>
  ```

- **Đừng dùng `RADIUS-5` cho phần tử chỉ *nhìn như* dính.** Nếu giữa hai phần tử có khoảng cách giữa các phần tử thật thì cả
  hai đều còn đủ bốn góc, và cả hai dùng mã bậc.

---

## Ánh xạ yêu cầu sang một class CSS

Nêu ranh giới, vai trò của nó, bán kính của ranh giới bao ngoài và khoảng cách đo được. Nếu thiếu
**một** dữ kiện quyết định, hỏi **một** câu cụ thể rồi dừng. Câu trả lời phải là một chuỗi class CSS hoặc
một câu hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Dựng một nút lưu | Thành phần điều khiển, góc tự do | `RADIUS-1` | `rounded-md` |
| Dựng một thẻ khoá học | Bề mặt sở hữu một vùng nội dung | `RADIUS-2` | `rounded-xl` |
| Dựng hộp thoại xác nhận xoá | Vẫn là bề mặt; to hơn không tròn hơn | `RADIUS-2` | `rounded-xl` |
| Hiện chữ cái đầu của người dùng trong một vòng tròn | Hình vốn là hình tròn | `RADIUS-3` | `rounded-full` |
| Bọc ảnh bìa trong thẻ, chừa viền mỏng `p-1` | 12 − 4, suy ra | `RADIUS-4` | `rounded-lg` |
| Bọc ảnh bìa trong thẻ `border-2 p-1` | 12 − (4+2), đường viền tính vào | `RADIUS-4` | `rounded-md` |
| Đặt ô nhập sát trong khung `p-2` | 12 − 8, suy ra | `RADIUS-4` | `rounded` |
| Đặt ảnh trong thẻ `p-4` | 16 ≥ 12, hết ràng buộc, ảnh tự đứng | `RADIUS-2` | `rounded-xl` |
| Cho ảnh chạm thẳng mép thẻ | Khoảng cách bằng 0 ⇒ cha cắt xén | `RADIUS-0` | cha `overflow-hidden rounded-xl`, ảnh không class CSS |
| Dựng dải thông báo chạy hết bề ngang màn hình | Ranh giới thật, từ chối bo | `RADIUS-0` | `rounded-none` |
| Dựng `div` để xếp ba khối theo cột | Không phải ranh giới | `RADIUS-0` | không class CSS bán kính |
| Dựng bảng trượt neo đáy màn hình | Hai góc dưới không tồn tại; độ lớn giữ bậc bề mặt | `RADIUS-5` | `rounded-t-xl` |
| Ghép ba nút thành một khối liền | Chỉ đầu và cuối chạm ra ngoài | `RADIUS-5` | cha `overflow-hidden rounded-md` |
| Dựng thanh tiến độ có phần đã hoàn thành | Viên nhộng, miễn trừ phép trừ | `RADIUS-3` | `rounded-full` cả hai lớp |
| Bọc một khối tóm tắt trong thẻ, chưa nói khoảng đệm trong | Thiếu **đúng một** dữ kiện quyết định | — | hỏi khoảng cách |

Ở dòng cuối, câu hỏi phân định là *"Thẻ chừa bao nhiêu khoảng đệm trong quanh khối đó, và thẻ có vẽ đường viền
không?"* — vì đó là hai số đầu vào của phép trừ, và không có chúng thì mọi đáp án đều là phỏng đoán.

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `RADIUS-0` / mọi mã khác | Ở đây có một ranh giới **vẽ ra** không: nền, viền, bóng, hay cắt xén? |
| *không class CSS* / `rounded-none` | Có một ranh giới thật đang **từ chối** bo, hay đơn giản là không có ranh giới nào? |
| `RADIUS-1` / `RADIUS-2` | Cái hộp này **là một thao tác**, hay **chứa một vùng**? |
| `RADIUS-1` / `RADIUS-3` | Đây là hình chữ nhật được bo, hay bản thân hình là viên nhộng? |
| `RADIUS-2` / `RADIUS-4` | Khoảng cách tới ranh giới ngoài có **nhỏ hơn** bán kính ngoài không? |
| `RADIUS-4` / `RADIUS-0` | Khoảng cách có bằng 0 không? Bằng 0 thì cha cắt xén, con để trơn. |
| `RADIUS-4` / `RADIUS-3` | Cái nằm trong có **góc** không, hay nó là viên nhộng? |
| `RADIUS-5` / mã bậc | Có cạnh nào chạy ra khỏi màn hình hoặc dính khít vào hàng xóm không? |
| `RADIUS-5` / `RADIUS-0` | Còn **ít nhất một** góc tồn tại không? Không còn góc nào thì là `RADIUS-0`. |

## Sai lầm lặp lại nhiều nhất

1. Hộp trong giữ nguyên bán kính của hộp ngoài — con dấu dán, lỗi gốc của cả mô-đun.
2. Chọn bán kính bằng mắt rồi hợp thức hoá bằng một giá trị tự chế `rounded-[…]`.
3. Quên cộng đường viền vào khoảng cách, lệch đúng một bậc mà không ai truy ra.
4. Làm tròn **lên** khi phép trừ rơi giữa hai bậc.
5. Bo cùng một góc ở cả cha lẫn con thay vì để cha cắt xén.
6. Nâng bậc cho hộp thoại, bảng trượt hay biểu ngữ chỉ vì chúng lớn hơn.
7. Viết `rounded-none` lên một hộp xếp chưa từng có ranh giới.
8. Đổi bán kính theo rê chuột, tiêu điểm hoặc theo trạng thái tải.
9. Trộn nút viên nhộng và nút chữ nhật trong cùng một hạng hành động.
10. Chỉ khai bán kính cho hàng đang được chọn, để rê chuột vẽ ra một hình khác.
