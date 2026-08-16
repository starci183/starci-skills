---
id: fe-principles-size-example
title: example.md
slug: /fe/principles/size/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp và ngoại lệ của từng mã SIZE-N, viết bằng className thuần.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `size` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **mã đánh dấu thường với `className` thường**. Không thư viện thành phần, không thiết kế
hệ thống riêng, không khoá đăng ký. Một luật chỉ đúng khi nó đúng ở bất kỳ giao diện nào — nên nếu một
ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó sai chỗ.

Mỗi mã có **nhiều trường hợp**, rồi tới **ngoại lệ** và **những thứ trông giống nhưng không phải mã đó**.
Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một class CSS duy nhất.

Đọc mọi ví dụ theo **trục**. Một hộp thường mang hai mã, và phần chú thích dưới mỗi trường hợp luôn nói rõ
mã nào thuộc trục nào.

---

## `SIZE-0` — nội dung tự đo

### Trường hợp: nhãn trạng thái trạng thái

```tsx
<span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
  Đã hoàn thành
</span>
```

Cả hai trục là `SIZE-0`. Chiều ngang là chữ cộng khoảng đệm trong; chiều dọc cũng vậy. Ép nhãn trạng thái rộng bằng
nhau sẽ biến "Đã hoàn thành" và "Mới" thành hai nhãn trông như cùng độ dài thông tin.

### Trường hợp: nút trong một hàng hành động

```tsx
<div className="flex items-center gap-2">
  <button className="rounded-md border px-3 py-2 text-sm" type="button">Huỷ</button>
  <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="submit">Xác nhận</button>
</div>
```

Trục ngang của mỗi nút là `SIZE-0` — nút dài đúng bằng nhãn của nó, và hai nhãn khác độ dài thì hai
nút khác bề rộng, đúng như nội dung.

### Trường hợp: nhãn đơn vị đứng cạnh số

```tsx
<p className="flex items-baseline gap-1">
  <span className="text-2xl font-semibold tabular-nums">1.240</span>
  <span className="text-sm text-neutral-500">điểm</span>
</p>
```

### Trường hợp: dòng siêu dữ liệu gọn của một bản ghi

```tsx
<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
  <span>PDF</span>
  <span>2,4 MB</span>
  <span>Cập nhật 16/08/2026</span>
</div>
```

### Trường hợp: hàng nhãn nhỏ bộ lọc

```tsx
<div className="flex flex-wrap items-center gap-2">
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Tất cả</button>
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Đang học</button>
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Đã hoàn thành</button>
</div>
```

Mỗi nhãn nhỏ là `SIZE-0` trên cả hai trục. Bảng lọc **không** cần các nhãn nhỏ bằng nhau; chúng khác nhau vì
chữ khác nhau.

### Ngoại lệ và nhầm lẫn

- **Đoạn văn dài không phải `SIZE-0`.** Nội dung đo được nó, nhưng để nội dung đo thì mắt lạc dòng.
  Đó là `SIZE-2`.

  ```tsx
  {/* SAI */}  <p className="text-base">…hai trăm chữ mô tả khoá học…</p>
  {/* ĐÚNG */} <p className="max-w-[65ch] text-base">…hai trăm chữ mô tả khoá học…</p>
  ```

- **`w-fit` không phải cách viết `SIZE-0`.** Trong luồng thường, `w-fit` là một lệnh **ghi đè** trục
  ngang từ `SIZE-1` xuống nội dung, và đó là một quyết định thật phải có lý do — thường là "nút này
  không được kéo dài hết dòng". Nó không phải cách trang trí cho `SIZE-0`.

  ```tsx
  {/* SAI: hộp vốn đã là SIZE-0, w-fit chỉ là tiếng ồn */}
  <span className="inline-flex w-fit rounded-full px-2 py-0.5 text-xs">Mới</span>
  ```

- **Biểu tượng không phải `SIZE-0`.** Xem `SIZE-4`: một SVG không có chiều dài tự nhiên nào đáng tin.

---

## `SIZE-1` — cha đo, hộp nhận trọn

### Trường hợp: ô nhập liệu trong một trường nhập liệu — không cần `w-full`

```tsx
<div className="flex flex-col gap-3">
  <label className="text-sm font-medium" htmlFor="email">Email</label>
  <input className="w-full rounded-md border px-3 py-2" id="email" type="email" />
</div>
```

`input` là nội tuyến-khối: mặc định của nó là `SIZE-0` và bề rộng do trình duyệt chọn. `w-full` ở đây
là **quyết định thật**, không phải lời thừa.

```tsx
{/* Ngược lại: <div> block trong luồng thường đã là SIZE-1 sẵn */}
<div className="rounded-lg border p-4">…</div>
{/* SAI: w-full ở đây chỉ lặp lại điều layout đã quyết */}
<div className="w-full rounded-lg border p-4">…</div>
```

### Trường hợp: con của flex nhận phần còn lại

```tsx
<div className="flex items-center gap-2">
  <input aria-label="Tìm kiếm" className="min-w-0 flex-1 rounded-md border px-3 py-2" />
  <button className="rounded-md border px-3 py-2 text-sm" type="button">Lọc</button>
</div>
```

Trục ngang của `input` là `SIZE-6`, không phải `SIZE-1`, vì `min-w-0` mới là quyết định làm cho
`flex-1` có hiệu lực. Trục ngang của `button` là `SIZE-0`.

### Trường hợp: nút chiếm hết bề ngang trên thiết bị di động

```tsx
<button className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm text-white sm:w-auto" type="submit">
  Ghi danh ngay
</button>
```

Trục ngang đổi mã theo điểm ngắt — `SIZE-1` khi hẹp, `SIZE-0` khi rộng — vì **vai trò bố cục thật
sự đổi**: ở màn hẹp nút là hành động chính của cả màn hình, ở màn rộng nó là một phần tử trong hàng.

### Trường hợp: con của lưới tự lấp đầy ô

```tsx
<div className="grid gap-4 sm:grid-cols-3">
  <article className="rounded-lg border p-4">…</article>
  <article className="rounded-lg border p-4">…</article>
  <article className="rounded-lg border p-4">…</article>
</div>
```

Mỗi `article` là `SIZE-1` trên cả hai trục và **không cần class CSS nào**: phần tử lưới mặc định kéo giãn.
Đây là chỗ `SIZE-1` không phát ra class CSS — mã vẫn tồn tại, chỉ là mặc định đã nói đúng.

### Trường hợp: phần thân hộp thoại chiếm hết bề ngang khung

```tsx
<div className="rounded-lg border bg-white p-6">
  <h2 className="text-lg font-medium">Xác nhận huỷ đăng ký</h2>
  <p className="mt-2 max-w-[60ch] text-sm text-neutral-600">…</p>
  <div className="mt-6 flex justify-end gap-2">
    <button className="rounded-md border px-3 py-2 text-sm" type="button">Quay lại</button>
    <button className="rounded-md bg-red-600 px-3 py-2 text-sm text-white" type="button">Huỷ đăng ký</button>
  </div>
</div>
```

### Ngoại lệ và nhầm lẫn

- **`w-screen` không phải `SIZE-1`.** Nó đo theo khung nhìn chứ không theo cha, và trên hệ có thanh
  cuộn chiếm chỗ nó luôn rộng hơn phần nhìn thấy được, tức là tự sinh ra cuộn ngang.

  ```tsx
  {/* SAI */}  <header className="w-screen border-b">…</header>
  {/* ĐÚNG */} <header className="w-full border-b">…</header>
  ```

- **`h-full` chỉ có nghĩa khi cha có chiều cao xác định.** Viết nó trên một cha cao theo nội dung là
  ra lệnh cho một phép đo không tồn tại, và class CSS im lặng không làm gì.

- **`flex-1` mà thiếu `min-w-0` không phải `SIZE-1` hoàn chỉnh.** Xem `SIZE-6`.

---

## `SIZE-2` — có một trần

### Trường hợp: cột văn bản có trần dòng đọc

```tsx
<article className="flex flex-col gap-4">
  <h1 className="text-2xl font-semibold">Vì sao quorum đọc–ghi không phải là đếm node</h1>
  <p className="max-w-[65ch] text-base leading-relaxed">
    …
  </p>
  <p className="max-w-[65ch] text-base leading-relaxed">
    …
  </p>
</article>
```

Trần đặt vì **mắt cần điểm quay đầu dòng**: quá 75 ký tự một dòng thì người đọc nhảy sai dòng khi
xuống hàng. Trần không đặt vì cột hẹp trông sang hơn.

### Trường hợp: khung trang căn giữa

```tsx
<div className="mx-auto w-full max-w-5xl px-4">
  <main className="flex flex-col gap-6">…</main>
</div>
```

Trục ngang là `SIZE-2`. `w-full` chỉ là đường đi tới trần, `mx-auto` là hệ quả bắt buộc của việc có
trần — thiếu nó thì trang dồn về một bên trên màn rộng, và đó là lỗi hay đi kèm mã này nhất.

### Trường hợp: biểu mẫu đăng nhập giữa màn

```tsx
<div className="mx-auto flex w-full max-w-sm flex-col gap-4">
  <h1 className="text-xl font-semibold">Đăng nhập</h1>
  <input className="w-full rounded-md border px-3 py-2" placeholder="Email" type="email" />
  <input className="w-full rounded-md border px-3 py-2" placeholder="Mật khẩu" type="password" />
  <button className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm text-white" type="submit">Tiếp tục</button>
</div>
```

### Trường hợp: hộp thoại có trần cả hai trục

```tsx
<div className="mx-auto flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg border bg-white">
  <header className="border-b p-4 text-lg font-medium">Chọn bài học</header>
  <div className="min-h-0 flex-1 overflow-y-auto p-4">…danh sách dài…</div>
  <footer className="border-t p-4 text-right">
    <button className="rounded-md border px-3 py-2 text-sm" type="button">Đóng</button>
  </footer>
</div>
```

Ngoài: trục ngang `SIZE-2` (`max-w-lg`), trục dọc `SIZE-2` (`max-h-[80vh]`) — hộp thoại không được cao
hơn màn hình. Trong: vùng cuộn có trục dọc `SIZE-6` (`min-h-0`), vì nếu không gỡ sàn tự nhiên thì nó
sẽ đẩy hộp thoại cao vượt trần thay vì cuộn.

### Trường hợp: ảnh không vượt khung chứa

```tsx
<figure className="flex flex-col gap-2">
  <img alt="Sơ đồ luồng thanh toán" className="h-auto max-w-full rounded-lg border" src="/flow.png" />
  <figcaption className="text-sm text-neutral-500">Luồng thanh toán rút gọn</figcaption>
</figure>
```

`img` mang kích thước nội tại của tệp, tức mặc định là `SIZE-0`. Trần ở đây là thứ ngăn một ảnh gốc
lớn phá vỡ cột.

### Trường hợp: thông báo nổi

```tsx
<div className="w-full max-w-sm rounded-lg border bg-white p-4 shadow-lg">
  <p className="text-sm">Đã lưu thay đổi.</p>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Trần không được đặt hai lần trên cùng một mạch.** Cha có trần, con lại có trần nhỏ hơn thì trần
  của cha không còn nghĩa gì và không ai biết cái nào là quyết định.

  ```tsx
  {/* SAI */}
  <div className="mx-auto w-full max-w-5xl">
    <section className="mx-auto w-full max-w-3xl">…</section>
  </div>
  ```

  Nếu cả hai trần đều thật thì chúng đang nói hai việc khác nhau — khung trang và cột đọc — và phải
  được viết ở hai lớp có tên rõ ràng, không lồng thẳng vào nhau.

- **`max-w-*` mà quên căn giữa là một trần chưa hoàn thành:**

  ```tsx
  {/* SAI */}  <div className="w-full max-w-5xl px-4">…</div>
  {/* ĐÚNG */} <div className="mx-auto w-full max-w-5xl px-4">…</div>
  ```

- **Trần không phải cách làm hộp nhỏ lại ở màn hẹp.** Ở màn hẹp trần **không có tác dụng**. Muốn nhỏ
  lại thì đó là việc của khoảng đệm trong hoặc của một mã khác.

---

## `SIZE-3` — có một sàn

### Trường hợp: ô nhập nhiều dòng

```tsx
<div className="flex flex-col gap-3">
  <label className="text-sm font-medium" htmlFor="feedback">Nhận xét của bạn</label>
  <textarea className="min-h-32 w-full rounded-md border p-3" id="feedback" />
</div>
```

Trục dọc là `SIZE-3`. Sàn nói rằng người dùng được mời viết **nhiều dòng**; ấn định `h-32` sẽ biến ô
này thành một khe cuộn ngay từ dòng thứ tư.

### Trường hợp: vùng trạng thái rỗng

```tsx
<div className="grid min-h-64 place-items-center rounded-lg border">
  <div className="flex flex-col items-center gap-3 text-center">
    <p className="text-sm text-neutral-500">Bạn chưa ghi danh khoá học nào</p>
    <button className="rounded-md border px-3 py-2 text-sm" type="button">Khám phá khoá học</button>
  </div>
</div>
```

Sàn giữ cho vùng này **không sụp xuống thành một dòng chữ** khi rỗng, để lúc dữ liệu về thì phần bên
dưới không nhảy lên rồi lại tụt xuống.

### Trường hợp: khung ứng dụng phủ hết chiều cao

```tsx
<div className="flex min-h-screen flex-col">
  <header className="border-b p-4">…</header>
  <main className="flex-1 p-4">…</main>
  <footer className="border-t p-4 text-sm text-neutral-500">…</footer>
</div>
```

`min-h-screen` là `SIZE-3` chứ không phải `SIZE-4`: trang **được phép** dài hơn màn hình, chỉ không
được ngắn hơn — nếu không thì phần cuối trôi lên giữa màn khi nội dung ít.

### Trường hợp: cột số giữ bề rộng để bảng không rung

```tsx
<li className="flex items-center justify-between p-4">
  <span className="truncate">Bài kiểm tra chương 3</span>
  <span className="min-w-16 text-right tabular-nums">98%</span>
</li>
```

Sàn ở đây tồn tại vì **giá trị sẽ đổi**: `9%` và `100%` không được làm nhãn bên trái nhảy chỗ.

### Trường hợp: nút có nhãn đổi theo trạng thái

```tsx
<button className="min-w-24 rounded-md bg-neutral-900 px-4 py-2 text-sm text-white" type="submit">
  {isSaving ? "Đang lưu…" : "Lưu"}
</button>
```

### Ngoại lệ và nhầm lẫn

- **Sàn không phải cách căn giữa theo chiều dọc.** Nếu mục tiêu là đưa nội dung ra giữa, hãy nói điều
  đó bằng bố cục, đừng nói bằng một con số chiều cao.

  ```tsx
  {/* SAI */}  <div className="min-h-64 pt-24">…</div>
  {/* ĐÚNG */} <div className="grid min-h-64 place-items-center">…</div>
  ```

- **Sàn ≠ ấn định.** `h-64` chặn cả hai chiều; `min-h-64` chỉ chặn chiều co. Dùng nhầm là cách nội
  dung dài bị cắt cụt trong im lặng.

- **Sàn phải giữ được trạng thái nội dung lớn nhất trong tập, hoặc thừa nhận là không.** Một sàn được
  chọn bằng trạng thái đang mở trên màn hình là một sàn chưa được kiểm.

- **Khung chờ phải dùng đúng sàn của nội dung thật:**

  ```tsx
  <div className="min-h-64 rounded-lg border p-4">
    <div className="h-4 w-40 rounded bg-neutral-200" />
  </div>
  ```

---

## `SIZE-4` — biến thiết kế ấn định

### Trường hợp: biểu tượng trong nút

```tsx
<button className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm" type="button">
  <svg aria-hidden="true" className="size-4" />
  Tải xuống
</button>
```

Nút là `SIZE-0` trên trục ngang; biểu tượng là `SIZE-4` trên cả hai trục.

### Trường hợp: ảnh đại diện

```tsx
<span className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-100 text-sm">AN</span>
```

`shrink-0` là phần bắt buộc của `SIZE-4` khi hộp nằm trong một hàng flex: thiếu nó, flex sẽ bóp ảnh
đại diện méo đi khi hàng chật, và một con số đã ấn định thì không được ai bóp.

### Trường hợp: chiều cao thành phần điều khiển để nút và ô nhập liệu thẳng hàng

```tsx
<div className="flex items-center gap-2">
  <input aria-label="Mã giảm giá" className="h-10 min-w-0 flex-1 rounded-md border px-3" />
  <button className="h-10 shrink-0 rounded-md border px-4 text-sm" type="button">Áp dụng</button>
</div>
```

Trục dọc của cả hai là `SIZE-4` vì chúng phải bằng nhau; khoảng đệm trong dọc không bảo đảm được điều đó khi
cỡ chữ hai bên khác nhau.

### Trường hợp: rãnh thanh tiến độ

```tsx
<div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
  <div className="h-2 w-1/3 rounded-full bg-neutral-900" />
</div>
```

Rãnh: trục dọc `SIZE-4`, trục ngang `SIZE-1`. Thanh bên trong: trục dọc `SIZE-4`, trục ngang
`SIZE-5` — một phần chia đã nêu rõ của cha.

### Trường hợp: phần đầu dính có chiều cao cố định

```tsx
<header className="sticky top-0 z-10 flex h-16 items-center border-b bg-white px-4">
  <strong>Bảng điều khiển</strong>
</header>
```

Chiều cao được ấn định vì **có thứ khác phải trừ đúng con số đó**: `scroll-mt-16` của các điểm neo bên
dưới không thể trừ một chiều cao do nội dung quyết.

### Trường hợp: thanh dọc điều hướng bề rộng cố định

```tsx
<div className="flex gap-8">
  <nav className="w-64 shrink-0">
    <a className="block rounded-md px-3 py-2 text-sm" href="#a">Tổng quan</a>
    <a className="block rounded-md px-3 py-2 text-sm" href="#b">Khoá học</a>
  </nav>
  <main className="min-w-0 flex-1">…</main>
</div>
```

### Trường hợp: chấm trạng thái

```tsx
<span className="inline-flex items-center gap-2 text-sm">
  <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
  Đang hoạt động
</span>
```

### Ngoại lệ và nhầm lẫn

- **Con số đo trên ảnh chụp màn hình không phải `SIZE-4`.**

  ```tsx
  {/* SAI */}  <svg className="h-[17px] w-[17px]" />
  {/* ĐÚNG */} <svg className="size-4" />
  ```

- **Đừng ấn định chiều cao cho hộp chứa chữ.** Chữ dài ra theo ngôn ngữ, theo cỡ chữ hệ thống, theo
  trạng thái. Ấn định là cách cắt cụt một câu mà không ai thấy.

  ```tsx
  {/* SAI */}  <div className="h-10 rounded-md border px-3">{title}</div>
  {/* ĐÚNG */} <div className="min-h-10 rounded-md border px-3 py-2">{title}</div>
  ```

- **`SIZE-4` trong hàng flex luôn đi kèm `shrink-0`.** Nếu không, mã bị flex ghi đè và con số đã chốt
  không còn là con số đã chốt.

---

## `SIZE-5` — một phần chia của cha

### Trường hợp: chia đôi có chủ đích

```tsx
<div className="flex">
  <section className="w-1/2 border-r p-4">…nội dung bài học…</section>
  <aside className="w-1/2 p-4">…ghi chú của bạn…</aside>
</div>
```

Tỉ lệ nói rằng hai bên **ngang tầm quan trọng**. Nếu không có khoảng cách giữa các phần tử giữa hai bên thì phân số là cách
diễn đạt đúng; nếu cần khoảng cách giữa các phần tử, xem mục ngoại lệ.

### Trường hợp: thẻ so sánh gói dịch vụ trên hàng cuộn ngang

```tsx
<div className="flex snap-x gap-4 overflow-x-auto">
  <article className="w-2/3 shrink-0 snap-start rounded-lg border p-4 sm:w-1/3">…Cơ bản…</article>
  <article className="w-2/3 shrink-0 snap-start rounded-lg border p-4 sm:w-1/3">…Tiêu chuẩn…</article>
  <article className="w-2/3 shrink-0 snap-start rounded-lg border p-4 sm:w-1/3">…Nâng cao…</article>
</div>
```

Phân số ở đây là một phát biểu về **hành vi**: hai phần ba bề rộng để thẻ kế tiếp lộ ra một phần, nói
cho người dùng biết còn có thứ để cuộn.

### Trường hợp: bố cục hai cột không đều

```tsx
<div className="flex gap-8">
  <section className="min-w-0 basis-2/3">…nội dung chính…</section>
  <aside className="basis-1/3">…tóm tắt đơn hàng…</aside>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Phân số cộng khoảng cách là một phép cộng sai.** Ba hộp `w-1/3` với `gap-4` chiếm nhiều hơn cha, và hàng
  sẽ tràn hoặc rơi dòng. Khi đã có khoảng cách giữa các phần tử, tỉ lệ thuộc về **rãnh của cha**, không thuộc về con.

  ```tsx
  {/* SAI */}
  <div className="flex gap-4">
    <div className="w-1/3">…</div><div className="w-1/3">…</div><div className="w-1/3">…</div>
  </div>

  {/* ĐÚNG: cha khai tỉ lệ, con trở về SIZE-1 trong ô của nó */}
  <div className="grid grid-cols-3 gap-4">
    <div>…</div><div>…</div><div>…</div>
  </div>
  ```

- **Phân số vì ảnh chụp hiện tại trông cân là `SIZE-5` giả.** Tỉ lệ phải nói được thành lời về tầm
  quan trọng, nếu không thì mã đúng là `SIZE-1` cho một bên và `SIZE-4` cho bên kia.

- **`w-1/2` cho con của lưới là thừa và sai.** Phần tử lưới đã được ô của nó đo; phân số ở đó chỉ làm
  con nhỏ hơn ô và lệch khỏi lưới.

---

## `SIZE-6` — gỡ sàn tự nhiên

### Trường hợp: hàng có tên dài và nút ở cuối

```tsx
<li className="flex items-center gap-3 p-4">
  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-100 text-sm">PDF</span>
  <span className="flex min-w-0 flex-1 flex-col gap-1">
    <span className="truncate font-medium">bao-cao-tong-ket-hoc-ky-mua-thu-2026-ban-cuoi.pdf</span>
    <span className="truncate text-sm text-neutral-500">Tải lên bởi Nguyễn Văn An</span>
  </span>
  <button className="shrink-0 rounded-md border px-3 py-2 text-sm" type="button">Tải xuống</button>
</li>
```

Ba mã trong một hàng: ảnh đại diện `SIZE-4`, cụm giữa `SIZE-6` trên trục ngang, nút `SIZE-0`. **`truncate`
không có tác dụng nếu thiếu `min-w-0`** — mặc định của phần tử flex là không được nhỏ hơn nội dung tối
thiểu của nó, nên chuỗi dài sẽ đẩy nút ra khỏi hàng thay vì bị cắt.

### Trường hợp: vùng cuộn trong cột cao xác định

```tsx
<div className="flex h-screen flex-col">
  <header className="shrink-0 border-b p-4">Hội thoại</header>
  <div className="min-h-0 flex-1 overflow-y-auto p-4">…tin nhắn…</div>
  <form className="shrink-0 border-t p-4">
    <input className="w-full rounded-md border px-3 py-2" />
  </form>
</div>
```

Trục dọc của vùng giữa là `SIZE-6`. Thiếu `min-h-0`, cột sẽ dài ra theo số tin nhắn và cả trang cuộn
thay vì chỉ vùng giữa cuộn — triệu chứng kinh điển của một sàn tự nhiên chưa được gỡ.

### Trường hợp: bảng đặt trong một ô lưới

```tsx
<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
  <section className="min-w-0 overflow-x-auto">
    <table className="w-full text-sm">…</table>
  </section>
  <aside className="lg:sticky lg:top-20">…</aside>
</div>
```

`minmax(0,1fr)` ở cha và `min-w-0` ở con nói **cùng một điều ở hai nơi khác nhau**: cả hai gỡ sàn tự
nhiên. Đây là ngoại lệ duy nhất được phép nói hai lần, vì lưới và con của lưới có sàn tự nhiên riêng.

### Trường hợp: đường dẫn phân cấp dài

```tsx
<nav className="flex min-w-0 items-center gap-1 text-sm text-neutral-500">
  <a className="shrink-0" href="#">Trang chủ</a>
  <span className="shrink-0">/</span>
  <a className="truncate" href="#">Lộ trình kỹ sư dữ liệu nâng cao khoá mùa thu</a>
</nav>
```

### Ngoại lệ và nhầm lẫn

- **`overflow-hidden` không thay được `min-w-0`.** Nó giấu phần tràn và giữ nguyên nguyên nhân: hộp
  vẫn được đo sai, chỉ là ta không nhìn thấy hậu quả nữa.

  ```tsx
  {/* SAI */}  <div className="flex-1 overflow-hidden"><span className="truncate">…</span></div>
  {/* ĐÚNG */} <div className="min-w-0 flex-1"><span className="truncate">…</span></div>
  ```

- **`min-w-0` rải khắp nơi là tiếng ồn.** Nó chỉ có nghĩa trên con của flex hoặc lưới, và chỉ khi bên
  trong có thứ **từ chối co lại**: chuỗi dài, bảng, ảnh, vùng cuộn.

- **`SIZE-6` và `SIZE-3` không cùng đứng trên một trục.** Viết `min-h-0` cạnh `min-h-32` là dựng sàn
  rồi dỡ chính nó; một trong hai là sai và phải bỏ hẳn.

---

## `SIZE-7` — trục kia suy ra

### Trường hợp: ảnh thu nhỏ bài giảng

```tsx
<article className="flex flex-col gap-2">
  <div className="aspect-video w-full overflow-hidden rounded-lg bg-neutral-100">
    <img alt="" className="size-full object-cover" src={lesson.thumbnail} />
  </div>
  <h3 className="font-medium">Thiết kế hàng đợi có bảo đảm thứ tự</h3>
</article>
```

Trục ngang `SIZE-1`, trục dọc `SIZE-7`. Chỗ được giữ **trước khi ảnh về**, nên khi ảnh tải xong tiêu
đề bên dưới không bị đẩy.

### Trường hợp: lưới ảnh vuông

```tsx
<div className="grid grid-cols-3 gap-2">
  {photos.map((photo) => (
    <img alt="" className="aspect-square w-full rounded-md object-cover" key={photo.id} src={photo.url} />
  ))}
</div>
```

### Trường hợp: bản đồ nhúng

```tsx
<div className="aspect-[4/3] w-full overflow-hidden rounded-lg border sm:aspect-[16/9]">
  <iframe className="size-full" src={mapUrl} title="Bản đồ địa điểm" />
</div>
```

Tỉ lệ đổi theo điểm ngắt là hợp lệ vì **vai trò đổi**: trên thiết bị di động bản đồ là một khối nội dung đứng
riêng, trên máy tính nó là một dải trong luồng.

### Trường hợp: văn bản gợi ý giữ đúng chỗ khi đang tải

```tsx
<div className="aspect-video w-full animate-pulse rounded-lg bg-neutral-200" />
```

Khung chờ dùng **đúng mã** của nội dung thật trên cả hai trục — đó là toàn bộ lý do nó tồn tại.

### Ngoại lệ và nhầm lẫn

- **Tỉ lệ và chiều cao ấn định không đứng cùng nhau.** Một trong hai sẽ thắng và không ai đọc ra được
  cái nào.

  ```tsx
  {/* SAI */}  <div className="aspect-video h-40 w-full" />
  ```

- **Tỉ lệ cần một trục đã được đo.** `aspect-video` trên một hộp mà trục ngang cũng do nội dung quyết
  thì không có gì để suy ra.

- **`object-cover` là bắt buộc khi ảnh thật không cùng tỉ lệ**, nếu không ảnh sẽ bị kéo méo bên trong
  cái khung mà ta vừa giữ chỗ.

---

## Mã lồng mã

### Trang đầy đủ: `SIZE-2` bọc `SIZE-1` bọc `SIZE-7`

```tsx
<div className="mx-auto w-full max-w-5xl px-4">
  <section className="flex flex-col gap-4">
    <h2 className="text-lg font-medium">Bài giảng mới</h2>
    <div className="grid gap-4 sm:grid-cols-3">
      {lessons.map((lesson) => (
        <article className="flex flex-col gap-2 rounded-lg border p-3" key={lesson.id}>
          <div className="aspect-video w-full overflow-hidden rounded-md bg-neutral-100">
            <img alt="" className="size-full object-cover" src={lesson.thumbnail} />
          </div>
          <h3 className="line-clamp-2 font-medium">{lesson.title}</h3>
          <p className="max-w-[60ch] text-sm text-neutral-500">{lesson.summary}</p>
        </article>
      ))}
    </div>
  </section>
</div>
```

Khung trang `SIZE-2`; mỗi `article` là `SIZE-1` trong ô lưới của nó; khung ảnh `SIZE-1` ngang và
`SIZE-7` dọc; đoạn mô tả mang trần dòng đọc riêng vì nó là văn bản chạy.

### Khung ứng dụng: `SIZE-3` bọc `SIZE-4` cạnh `SIZE-6`

```tsx
<div className="flex min-h-screen flex-col">
  <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4">
    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-neutral-900 text-xs text-white">A</span>
    <span className="min-w-0 flex-1 truncate font-medium">Lộ trình kỹ sư nền tảng — học kỳ mùa thu</span>
    <button className="shrink-0 rounded-md border px-3 py-1.5 text-sm" type="button">Thoát</button>
  </header>
  <div className="flex min-h-0 flex-1">
    <nav className="hidden w-64 shrink-0 overflow-y-auto border-r p-3 lg:block">…</nav>
    <main className="min-w-0 flex-1 overflow-y-auto p-6">
      <article className="mx-auto flex w-full max-w-[70ch] flex-col gap-4">…</article>
    </main>
  </div>
</div>
```

Sáu mã trong một cây: `min-h-screen` là `SIZE-3`; `h-16` và `size-8` và `w-64` là `SIZE-4`; tiêu đề
giữa phần đầu và `main` là `SIZE-6`; cột văn bản trong `main` là `SIZE-2`.

---

## Ánh xạ yêu cầu sang một class CSS

Nêu hộp, **trục**, bố cục của cha và trạng thái nội dung. Nếu thiếu **một** dữ kiện quyết định, hỏi
**một** câu cụ thể rồi dừng. Câu trả lời phải là một chuỗi class CSS hoặc một câu hỏi — không bao giờ cả
hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Hiện nhãn trạng thái gọn cạnh tiêu đề | Nhãn dài đúng bằng chữ của nó | `SIZE-0` | *không class CSS kích thước* |
| Cho ô nhập chiếm hết bề ngang của trường nhập liệu | Thành phần điều khiển mặc định co theo nội dung, phải nói khác đi | `SIZE-1` | `w-full` |
| Đặt phần mô tả sao cho đọc không mỏi mắt | Dòng quá dài thì mắt lạc dòng khi xuống hàng | `SIZE-2` | `max-w-[65ch]` |
| Trang không được căng ra trên màn siêu rộng | Khung trang có trần và phải căn giữa | `SIZE-2` | `mx-auto w-full max-w-5xl` |
| Ô nhận xét phải mời người ta viết vài dòng | Nội dung được phép dài hơn, chỉ không được ngắn hơn | `SIZE-3` | `min-h-32` |
| Vùng danh sách rỗng đừng làm trang nhảy | Giữ chỗ trước cho trạng thái chưa tới | `SIZE-3` | `min-h-64` |
| Biểu tượng trong mọi nút phải giống nhau | Con số thuộc về hệ, không thuộc về chỗ dùng | `SIZE-4` | `size-4 shrink-0` |
| Nút và ô nhập phải thẳng hàng | Chiều cao phải bằng nhau bất kể cỡ chữ hai bên | `SIZE-4` | `h-10` |
| Chia đôi giữa bài học và ghi chú | Hai bên ngang tầm quan trọng, không có khoảng cách giữa các phần tử | `SIZE-5` | `w-1/2` |
| Nội dung chính hai phần ba, tóm tắt một phần ba | Tỉ lệ là phát biểu về tầm quan trọng | `SIZE-5` | `basis-2/3` và `basis-1/3` |
| Tên tệp dài phải cắt bằng ba chấm | Nội dung đang từ chối co, phải xử cho cha thắng | `SIZE-6` | `min-w-0 flex-1` |
| Chỉ vùng tin nhắn cuộn, cả trang thì không | Sàn tự nhiên của cột đang vô hiệu hoá chiều cao cha | `SIZE-6` | `min-h-0 flex-1 overflow-y-auto` |
| Ảnh bìa đừng đẩy tiêu đề khi tải xong | Giữ chỗ bằng tỉ lệ trước khi nội dung về | `SIZE-7` | `aspect-video w-full` |
| Ảnh thành viên hiện dạng ô vuông trong lưới | Trục dọc suy ra từ trục ngang | `SIZE-7` | `aspect-square w-full object-cover` |
| Đặt thẻ này rộng vừa phải | Chưa nêu ai đo và trên trục nào ⇒ dừng lại hỏi | — | một câu hỏi, không phải class CSS |

Ở dòng cuối, câu phân định là: *"Bề rộng này do cha quyết, hay có một mức mà vượt qua thì thẻ hỏng
việc?"*

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `SIZE-0` / `SIZE-1` | Bỏ hết nội dung ra thì chiều dài này có phải giữ nguyên không? |
| `SIZE-0` / `SIZE-2` | Nội dung này có phải văn bản chạy dài không? |
| `SIZE-1` / `SIZE-2` | Có một mức mà vượt qua thì hộp hỏng việc chứ không chỉ xấu không? |
| `SIZE-1` / `SIZE-5` | Hộp nhận hết phần cha mời, hay một tỉ lệ đã nêu rõ? |
| `SIZE-1` / `SIZE-6` | Bên trong có thứ nào từ chối co lại — chuỗi dài, bảng, vùng cuộn? |
| `SIZE-2` / `SIZE-3` | Nỗi lo là nở quá, hay là sụp xuống? |
| `SIZE-3` / `SIZE-4` | Nội dung có được phép làm hộp dài thêm không? |
| `SIZE-4` / `SIZE-5` | Con số có phải giống nhau ở mọi bề rộng của cha không? |
| `SIZE-4` / `SIZE-7` | Cả hai trục đều đã biết, hay chỉ một trục cộng một tỉ lệ? |
| `SIZE-3` / `SIZE-6` | Ta đang dựng một sàn, hay dỡ cái sàn trình duyệt tự dựng? |

## Sai lầm lặp lại nhiều nhất

1. Nói "hộp này kích thước bao nhiêu" thay vì hỏi từng trục một, rồi để một trục không ai quyết.
2. Chọn con số vì nó làm ảnh chụp hiện tại trông cân.
3. `flex-1` mà thiếu `min-w-0`, rồi đổ lỗi cho `truncate` là không chạy.
4. `w-full` rải trên con khối trong luồng thường, lặp lại điều bố cục đã quyết.
5. `max-w-*` mà quên `mx-auto`, để trang dồn về một bên trên màn rộng.
6. Văn bản chạy không có trần dòng đọc.
7. `h-*` thay cho `min-h-*` trên hộp chứa chữ, rồi cắt cụt câu trong im lặng.
8. `SIZE-4` trong hàng flex mà quên `shrink-0`, để một con số đã chốt bị bóp méo.
9. Ba `w-1/3` cộng `gap`, rồi thêm một giá trị lẻ để "bù" phần thừa.
10. Khung chờ dùng mã khác nội dung thật, biến trạng thái tải thành một cú nhảy bố cục.
11. `w-screen` cho khung trang, tự sinh cuộn ngang trên hệ có thanh cuộn chiếm chỗ.
12. `overflow-hidden` để giấu một phép đo sai thay vì sửa nó.
