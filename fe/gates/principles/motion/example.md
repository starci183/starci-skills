---
id: fe-principles-motion-example
title: example.md
slug: /gates/principles/motion/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp và ngoại lệ của từng mã MOTION-N, viết bằng className thuần.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `motion` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **mã đánh dấu thường với `className` thường**. Không thư viện thành phần, không thiết kế
hệ thống riêng, không khoá đăng ký. Một luật chỉ đúng khi nó đúng ở bất kỳ giao diện nào — nên nếu một
ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó sai chỗ.

Mỗi mã có **nhiều trường hợp**, rồi tới **ngoại lệ** và **những thứ trông giống nhưng không phải mã đó**.
Mọi chuỗi class CSS phát ra chuyển động đều mang sẵn vế `MOTION-5` của nó, vì đó là bất biến chứ không
phải một bước dọn dẹp để dành cho sau. Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một cặp
nhịp thời gian duy nhất.

---

## `MOTION-0` — không khai báo chuyển động

### Trường hợp: bộ đếm cập nhật tại chỗ

```tsx
<div className="flex flex-col gap-1">
  <span className="text-2xl font-semibold tabular-nums">{completedCount}</span>
  <span className="text-sm text-neutral-500">bài đã hoàn thành</span>
</div>
```

Con số đổi vì dữ liệu đổi. Không ai dõi theo một chữ số bay từ `41` sang `42`; người ta **đọc** nó.
Một cross-fade ở đây chỉ mua thêm một khoảng thời gian mà con số không đọc được.

### Trường hợp: dòng lỗi kiểm tra tính hợp lệ trong ô đã chừa sẵn

```tsx
<div className="flex flex-col gap-3">
  <label className="text-sm font-medium" htmlFor="email">Email</label>
  <div className="flex flex-col gap-1">
    <input className="rounded-md border px-3 py-2" id="email" type="email" />
    <p className="min-h-4 text-xs text-red-600">{errorMessage}</p>
  </div>
</div>
```

Ô lỗi **luôn tồn tại** và luôn chiếm đúng chiều cao đó, nên không có gì vào, không có gì ra, không có
gì dịch chuyển. `min-h-4` là cách giải quyết đúng cho việc "đừng nhảy bố cục" — không phải một
chuyển tiếp.

### Trường hợp: vòng tiêu điểm

```tsx
<button
  className="rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
  type="button"
>
  Lưu
</button>
```

Người dùng bàn phím đi nhanh hơn mọi thời lượng. Một vòng tiêu điểm tới trễ `150ms` là một vòng tiêu điểm bị
mất ở nửa số lần chuyển tiêu điểm.

### Trường hợp: luồng tin thời gian thực chèn bản ghi mới lên đầu

```tsx
<ul className="divide-y rounded-lg border">
  {events.map((event) => (
    <li className="flex items-center justify-between p-4" key={event.id}>
      <span className="text-sm">{event.label}</span>
      <time className="text-xs tabular-nums text-neutral-500" dateTime={event.at}>{event.time}</time>
    </li>
  ))}
</ul>
```

Người dùng không bấm gì cả; máy chủ đẩy xuống. Nếu các hàng trượt xuống nhường chỗ, mục tiêu mà người
dùng đang định bấm sẽ chạy khỏi con trỏ. Nhảy một khung hình còn đỡ hơn bấm nhầm.

### Trường hợp: bảng được refresh trong lúc con trỏ đang ở trên

```tsx
<tbody className="divide-y">
  {rows.map((row) => (
    <tr key={row.id}>
      <td className="p-3 text-sm">{row.name}</td>
      <td className="p-3 text-sm tabular-nums">{row.amount}</td>
    </tr>
  ))}
</tbody>
```

### Ngoại lệ và nhầm lẫn

- **`transition-all` là cấm, ở mọi mã.** Nó chạy cả những thuộc tính chưa ai quyết định, kể cả
  thuộc tính được thêm vào sáu tháng sau:

  ```tsx
  {/* SAI  */} <button className="transition-all duration-300 hover:bg-neutral-100" />
  {/* ĐÚNG */} <button className="transition-colors duration-150 ease-out hover:bg-neutral-100 motion-reduce:transition-none" />
  ```

- **Trang trí mà nhúc nhích là nhiễu.** Một thẻ nghiêng và trôi theo con trỏ không trả lời câu hỏi
  nào của người dùng:

  ```tsx
  {/* SAI */} <article className="transition-transform duration-500 hover:-translate-y-2 hover:rotate-1" />
  ```

- **Đừng làm chậm vòng tiêu điểm để "cho mượt".** `transition` trên `outline` hoặc `ring` là cách biến
  một chỉ báo trợ năng thành một hiệu ứng:

  ```tsx
  {/* SAI */} <input className="transition-shadow duration-300 focus-visible:ring-2" />
  ```

- **`duration-0` không tồn tại trong thang này.** Chỉ viết `transition-none` khi cần **phủ định** một
  chuyển động mà phần tử cha hoặc biến thể khác đã áp vào.

---

## `MOTION-1` — một vật vào hoặc rời khỏi cây

### Trường hợp: thông báo nổi xác nhận

```tsx
<div
  className="fixed bottom-6 right-6 rounded-lg border bg-white p-4 shadow-lg
             transition-opacity duration-200 ease-out data-[state=closed]:duration-100 data-[state=closed]:ease-in
             data-[state=closed]:opacity-0 motion-reduce:transition-none"
  data-state={isOpen ? "open" : "closed"}
  role="status"
>
  Đã lưu thay đổi
</div>
```

Vào `200` và giảm tốc vì cần được **tìm thấy**; ra `100` và tăng tốc vì đã bị gạt bỏ.

### Trường hợp: hộp thoại và nền mờ — hai phần tử, cùng một mã

```tsx
<div
  className="fixed inset-0 bg-black/40 transition-opacity duration-200 ease-out
             data-[state=closed]:opacity-0 data-[state=closed]:duration-100 data-[state=closed]:ease-in
             motion-reduce:transition-none"
  data-state={isOpen ? "open" : "closed"}
/>
<div
  className="fixed left-1/2 top-1/2 w-[min(32rem,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-white p-6
             transition-opacity duration-200 ease-out data-[state=closed]:opacity-0
             data-[state=closed]:duration-100 data-[state=closed]:ease-in motion-reduce:transition-none"
  data-state={isOpen ? "open" : "closed"}
  role="dialog"
>
  …
</div>
```

Nền mờ và hộp thoại là hai nút DOM, và cả hai đều **không tồn tại** khi đóng. Cùng một mã áp cho hai
nút DOM là chuyện bình thường; điều bị cấm là một nút DOM mang hai mã.

### Trường hợp: trình đơn thả xuống

```tsx
<div
  className="absolute right-0 top-full mt-2 w-56 rounded-lg border bg-white p-1 shadow-lg
             transition-opacity duration-200 ease-out data-[closed]:opacity-0
             data-[closed]:duration-100 data-[closed]:ease-in motion-reduce:transition-none"
  role="menu"
>
  <button className="w-full rounded px-3 py-2 text-left text-sm" role="menuitem" type="button">Đổi tên</button>
  <button className="w-full rounded px-3 py-2 text-left text-sm" role="menuitem" type="button">Nhân bản</button>
</div>
```

### Trường hợp: biểu ngữ chỉ tồn tại khi có lỗi

```tsx
{error ? (
  <div
    className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700
               transition-opacity duration-200 ease-out motion-reduce:transition-none"
    role="alert"
  >
    {error.message}
  </div>
) : null}
```

So sánh với `MOTION-0` ở trên: ở đó dòng lỗi **luôn có mặt** và chỉ đổi chữ. Ở đây cả cái biểu ngữ
không tồn tại cho tới khi có lỗi. Khác nhau ở **sự tồn tại**, không phải ở chỗ nhìn thấy hay không.

### Trường hợp: nội dung thật thế chỗ khung chờ

```tsx
<section className="flex flex-col gap-3">
  {isLoading ? (
    <div className="h-24 rounded-lg bg-neutral-200 animate-pulse motion-reduce:animate-none" />
  ) : (
    <article className="rounded-lg border p-4 transition-opacity duration-200 ease-out motion-reduce:transition-none">
      {summary}
    </article>
  )}
</section>
```

Khung chờ là `MOTION-4` (chờ không biết bao lâu). Nội dung thật là `MOTION-1` (vừa vào cây). Hai phần
tử, hai mã.

### Trường hợp: dòng mới được chèn vào giỏ hàng do người dùng bấm thêm

```tsx
<li className="flex items-center justify-between p-4 transition-opacity duration-200 ease-out motion-reduce:transition-none">
  <span className="text-sm">{item.name}</span>
  <span className="text-sm tabular-nums">{item.price}</span>
</li>
```

Người dùng **vừa bấm thêm**, nên họ đang chờ thứ này xuất hiện. Đó là điều tách trường hợp này khỏi
`MOTION-0` ở luồng tin thời gian thực.

### Ngoại lệ và nhầm lẫn

- **`hidden` không chuyển tiếp được.** `display` không phải thuộc tính chạy được; class CSS chuyển tiếp
  đặt cạnh `hidden` là một dòng chết:

  ```tsx
  {/* SAI  */} <div className="hidden transition-opacity duration-200 data-[open]:block" />
  {/* ĐÚNG */} <div className="opacity-0 transition-opacity duration-200 ease-out data-[open]:opacity-100 motion-reduce:transition-none" />
  ```

- **Đừng dùng `animate-*` để cho một vật đi vào.** `animate-*` vô hạn thuộc về `MOTION-4`; trộn hai
  họ class CSS làm mất khả năng đọc mã từ chuỗi class CSS:

  ```tsx
  {/* SAI */} <div className="animate-bounce rounded-lg border p-4" />
  ```

- **Vật chỉ đổi màu thì không hề vào hay ra.** Đó là `MOTION-2`.
- **Vào và ra bằng nhau là sai.** `duration-200` cho cả hai vế nghĩa là mỗi lần đóng một trình đơn, người
  dùng trả thêm `100ms` cho một thứ họ vừa từ chối.

---

## `MOTION-2` — vật vẫn ở đó, chỉ đổi lớp sơn

### Trường hợp: nút đổi nền khi rê chuột và khi nhấn giữ

```tsx
<button
  className="rounded-md border px-3 py-2 text-sm
             transition-colors duration-150 ease-out
             hover:bg-neutral-100 active:bg-neutral-200 motion-reduce:transition-none"
  type="button"
>
  Xem trước
</button>
```

### Trường hợp: rê chuột phải nằm trong truy vấn rê chuột

```tsx
<a
  className="rounded-md px-3 py-2 text-sm transition-colors duration-150 ease-out
             [@media(hover:hover)]:hover:bg-neutral-100 motion-reduce:transition-none"
  href="#courses"
>
  Khoá học
</a>
```

Thiết bị cảm ứng không có trạng thái rê chuột. Không chặn thì một cú chạm để lại liên kết mắc kẹt ở khung
hình đã-rê chuột cho tới khi người dùng chạm chỗ khác — một trạng thái không ai yêu cầu và không ai gỡ
được.

### Trường hợp: nút bị vô hiệu hoá mờ đi

```tsx
<button
  className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white
             transition-opacity duration-150 ease-out disabled:opacity-50 motion-reduce:transition-none"
  disabled={!isValid}
  type="submit"
>
  Gửi bài
</button>
```

Đây là `MOTION-2` dù thuộc tính chạy là `opacity`, giống `MOTION-1`. **Thuộc tính không phân định
mã**; cặp nhịp thời gian mới phân định. `duration-150 ease-out` chỉ thuộc `MOTION-2` và không thuộc mã nào
khác.

### Trường hợp: mũi tên vùng thu gọn xoay tại chỗ

```tsx
<svg
  aria-hidden="true"
  className="size-4 transition-transform duration-150 ease-out
             group-data-[open]:rotate-180 motion-reduce:transition-none"
/>
```

Xoay là `transform`, nhưng hộp của mũi tên **không đổi** và không phần tử nào phải nhích. Bố cục
trước và sau trùng khít, nên đây là lớp sơn, không phải hình học.

### Trường hợp: nhãn nhỏ bộ lọc chuyển sang trạng thái đã chọn

```tsx
<button
  aria-pressed={isSelected}
  className="rounded-full border px-3 py-1 text-sm transition-colors duration-150 ease-out
             aria-pressed:border-neutral-900 aria-pressed:bg-neutral-900 aria-pressed:text-white
             motion-reduce:transition-none"
  type="button"
>
  Đang học
</button>
```

`aria-pressed` mang thông tin; màu chỉ minh hoạ nó. Đó là luật "chuyển động không bao giờ là thông
tin duy nhất", áp ở mức nhỏ nhất.

### Trường hợp: thẻ nổi bóng khi rê chuột

```tsx
<article
  className="rounded-lg border p-4 transition-shadow duration-150 ease-out
             [@media(hover:hover)]:hover:shadow-md motion-reduce:transition-none"
>
  …
</article>
```

### Trường hợp: nút lún nhẹ khi nhấn giữ

```tsx
<button
  className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white
             transition-transform duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none"
  type="button"
>
  Đăng ký học
</button>
```

Lún tại chỗ, không đẩy ai. Vẫn là lớp sơn.

### Ngoại lệ và nhầm lẫn

- **Vòng tiêu điểm không được nằm trong chuyển tiếp.** Chỉ nền xung quanh mới được:

  ```tsx
  {/* SAI  */} <input className="transition-shadow duration-150 focus-visible:ring-2" />
  {/* ĐÚNG */} <input className="transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:border-neutral-900 motion-reduce:transition-none" />
  ```

- **Nếu có phần tử khác phải nhích, đó là `MOTION-3`.** Thanh chỉ báo thẻ tab trượt sang thẻ tab khác đổi
  **chỗ** của nó trong vùng chứa, nên nó không thuộc mã này.
- **Đừng cho `duration-300` vào một rê chuột.** `300` là chữ ký của `MOTION-3`; đọc thấy nó trên một
  rê chuột là đọc thấy một mã bị chọn sai:

  ```tsx
  {/* SAI */} <button className="transition-colors duration-300 hover:bg-neutral-100" />
  ```

---

## `MOTION-3` — vật vẫn ở đó, nhưng đổi chỗ hoặc đổi cỡ

### Trường hợp: vùng thu gọn mở ra và đẩy nội dung bên dưới

```tsx
<div
  className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-in-out
             data-[open]:grid-rows-[1fr] motion-reduce:transition-none"
  data-open={isOpen || undefined}
>
  <div className="overflow-hidden">
    <p className="pt-3 text-sm text-neutral-600">…nội dung bài học…</p>
  </div>
</div>
```

`height: auto` không chạy được, nên chiều cao được diễn đạt bằng `grid-template-rows`. Đây là ràng
buộc kỹ thuật, không phải một mã khác.

### Trường hợp: thanh chỉ báo thẻ tab trượt

```tsx
<div className="relative flex items-center gap-2" role="tablist">
  <button className="px-3 py-2 text-sm" role="tab" type="button">Tổng quan</button>
  <button className="px-3 py-2 text-sm" role="tab" type="button">Hoạt động</button>
  <span
    className="absolute bottom-0 h-0.5 w-24 bg-neutral-900
               transition-transform duration-300 ease-in-out motion-reduce:transition-none"
    style={{ transform: `translateX(${indicatorOffset}px)` }}
  />
</div>
```

Cả hai đầu đều nằm trên màn hình, nên nhịp đối xứng: `ease-in-out`. Không đầu nào "từ hư không tới".

### Trường hợp: thanh bên thu gọn

```tsx
<aside
  className="w-64 shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out
             data-[collapsed]:w-16 motion-reduce:transition-none"
  data-collapsed={isCollapsed || undefined}
>
  …
</aside>
```

### Trường hợp: hàng đổi vị trí sau khi người dùng bấm sắp xếp

```tsx
<li
  className="transition-transform duration-300 ease-in-out motion-reduce:transition-none"
  style={{ transform: `translateY(${row.offset}px)` }}
>
  <span className="text-sm">{row.name}</span>
</li>
```

Người dùng **vừa bấm sắp xếp**, nên họ cần tin rằng hàng ở vị trí mới chính là hàng họ đang nhìn.
Cũng chuyển động đó, nếu do máy chủ đẩy xuống, là `MOTION-0`.

### Trường hợp: thanh tiến trình có phần trăm thật

```tsx
<div aria-valuenow={percent} className="h-2 w-full overflow-hidden rounded-full bg-neutral-200" role="progressbar">
  <div
    className="h-full rounded-full bg-neutral-900 transition-[width] duration-300 ease-in-out motion-reduce:transition-none"
    style={{ width: `${percent}%` }}
  />
</div>
```

**Đích đã biết** ngay lúc chuyển động bắt đầu. Đó là câu hỏi duy nhất tách mã này khỏi `MOTION-4`.

### Trường hợp: phần đầu dính thu nhỏ khi cuộn

```tsx
<header
  className="sticky top-0 h-20 border-b bg-white transition-[height] duration-300 ease-in-out
             data-[compact]:h-14 motion-reduce:transition-none"
  data-compact={isScrolled || undefined}
>
  …
</header>
```

### Ngoại lệ và nhầm lẫn

- **Đừng chạy `top` / `left` khi `transform` nói cùng một điều.** Hai thuộc tính kia buộc trình duyệt
  tính lại bố cục mỗi khung hình:

  ```tsx
  {/* SAI  */} <div className="absolute transition-[left] duration-300" style={{ left: offset }} />
  {/* ĐÚNG */} <div className="absolute transition-transform duration-300 ease-in-out motion-reduce:transition-none" style={{ transform: `translateX(${offset}px)` }} />
  ```

- **Quãng đường dài không mua thêm thời gian.** Một khung phủ kín màn hình vẫn đi hết trong `300`:

  ```tsx
  {/* SAI */} <div className="transition-transform duration-700 ease-in-out" />
  ```

- **Thay đổi hệ thống đẩy xuống là `MOTION-0`.** Xem lại trường hợp luồng tin thời gian thực.

---

## `MOTION-4` — chờ mà không biết bao lâu

### Trường hợp: vòng quay trong nút sau khi bấm gửi

```tsx
<button
  aria-busy={isSubmitting}
  className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-3 py-2 text-sm text-white
             transition-colors duration-150 ease-out disabled:opacity-50 motion-reduce:transition-none"
  disabled={isSubmitting}
  type="submit"
>
  {isSubmitting ? (
    <span className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin motion-reduce:animate-none" />
  ) : null}
  {isSubmitting ? "Đang gửi…" : "Gửi bài"}
</button>
```

Hai mã lồng nhau trên hai nút DOM: nút là `MOTION-2` (đổi lớp sơn khi bị vô hiệu hoá), vòng quay bên
trong là `MOTION-4`. Và chữ đổi cùng lúc, nên nếu vòng quay biến mất dưới `reduce`, thông tin vẫn
còn.

### Trường hợp: khung chờ chờ dữ liệu

```tsx
<div className="flex flex-col gap-3" aria-busy="true">
  <div className="h-5 w-40 rounded bg-neutral-200 animate-pulse motion-reduce:animate-none" />
  <div className="h-5 w-64 rounded bg-neutral-200 animate-pulse motion-reduce:animate-none" />
  <div className="h-5 w-52 rounded bg-neutral-200 animate-pulse motion-reduce:animate-none" />
</div>
```

Dưới `reduce`, khối xám **vẫn còn** — chỉ nhịp nhấp nháy mất. Đó là "thay thế chứ không xoá", ở dạng
đơn giản nhất: hình dạng đã tự nói lên là đang chờ.

### Trường hợp: thanh tiến trình bất định

```tsx
<div className="h-1 w-full overflow-hidden rounded-full bg-neutral-200" role="progressbar">
  <div className="h-full w-1/3 rounded-full bg-neutral-900 animate-[slide_1.2s_linear_infinite] motion-reduce:animate-none" />
</div>
```

`linear` và `infinite`. Mọi nhịp chuyển động đều hàm ý một điểm bắt đầu và một điểm kết thúc, mà ở đây không có
cái nào; một vòng chạy có gia tốc là một vòng chạy đang nói dối rằng nó sắp xong.

### Trường hợp: nhãn đang đồng bộ

```tsx
<span
  className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-neutral-600"
  role="status"
>
  <span className="size-1.5 rounded-full bg-amber-500 animate-pulse motion-reduce:animate-none" />
  Đang đồng bộ
</span>
```

Chấm nhấp nháy là trang trí của một sự thật; **chữ** mới là sự thật. Bỏ chấm đi thì trạng thái vẫn
đọc được, và đó chính là phép thử cho luật "chuyển động không bao giờ là thông tin duy nhất".

### Trường hợp: con trỏ nhấp nháy khi câu trả lời đang được sinh dần

```tsx
<p className="text-sm">
  {streamedText}
  <span className="ml-0.5 inline-block h-4 w-0.5 bg-neutral-900 animate-pulse motion-reduce:animate-none" />
</p>
```

### Ngoại lệ và nhầm lẫn

- **Đích đã biết ⇒ `MOTION-3`, không phải `MOTION-4`.** Tải tệp có tổng dung lượng thì có phần trăm,
  và một vòng quay ở đó là một lời nói dối rằng hệ thống không biết:

  ```tsx
  {/* SAI  */} <span className="animate-spin" /> {/* trong khi đã có percent */}
  {/* ĐÚNG */} <div className="transition-[width] duration-300 ease-in-out motion-reduce:transition-none" style={{ width: `${percent}%` }} />
  ```

- **Chờ ngắn hơn ngưỡng cảm nhận là `MOTION-0`.** Vòng quay hiện ra rồi biến mất trong nháy mắt đọc
  như một sự cố, không đọc như đang làm việc.
- **Không gì được nhấp nháy quá ba lần một giây.** Chu kỳ dưới `~333ms` là ngưỡng cấm, không phải một
  lựa chọn thẩm mỹ:

  ```tsx
  {/* SAI */} <span className="animate-[blink_0.2s_steps(2)_infinite]" />
  ```

- **`animate-*` vô hạn chỉ thuộc mã này.** Dùng nó cho một vật đang vào cây làm chuỗi class CSS mất khả
  năng tự khai mã.

---

## `MOTION-5` — người dùng đã xin bớt chuyển động

### Trường hợp: hộp thoại bỏ phần trượt, giữ phần mờ dần

```tsx
<div
  className="fixed left-1/2 top-1/2 w-[min(32rem,90vw)] rounded-xl border bg-white p-6
             -translate-x-1/2 -translate-y-1/2
             transition-[opacity,transform] duration-200 ease-out
             data-[closed]:translate-y-[calc(-50%+0.5rem)] data-[closed]:opacity-0
             motion-reduce:transition-opacity motion-reduce:data-[closed]:translate-y-[-50%]"
  data-closed={!isOpen || undefined}
  role="dialog"
>
  …
</div>
```

Đây là **thay thế**, không phải xoá: đổi độ mờ không gây chóng mặt, còn dịch chuyển thì có. Người
dùng vẫn được biết hộp thoại vừa xuất hiện.

### Trường hợp: rút gọn hẳn — vùng thu gọn nhảy tới chiều cao cuối

```tsx
<div
  className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-in-out
             data-[open]:grid-rows-[1fr] motion-reduce:transition-none"
  data-open={isOpen || undefined}
>
  <div className="overflow-hidden">…</div>
</div>
```

Không có gì để thay thế: nội dung tới ngay lập tức, và trạng thái mở vẫn đọc được từ `aria-expanded`
của nút điều khiển.

### Trường hợp: vòng quay đổi thành chỉ báo tĩnh kèm chữ

```tsx
<span className="inline-flex items-center gap-2 text-sm text-neutral-600" role="status">
  <span
    className="size-4 rounded-full border-2 border-neutral-300 border-t-neutral-900
               animate-spin motion-reduce:animate-none"
  />
  Đang xử lý thanh toán
</span>
```

Vòng tròn **vẫn hiển thị**, chỉ dừng quay. Cách làm sai là giấu nó đi:

```tsx
{/* SAI */} <span className="animate-spin motion-reduce:hidden" />
```

Người xin bớt chuyển động không xin bớt thông tin.

### Trường hợp: cuộn được điều khiển bằng lệnh

```tsx
<div className="h-96 overflow-y-auto scroll-auto motion-safe:scroll-smooth">
  …
</div>
```

`motion-safe:` là chiều ngược lại của `motion-reduce:`: chuyển động chỉ được **bật lên** khi người
dùng chưa xin bớt. Cuộn mượt mặc định tắt, vì cuộn là chuyển động phủ vùng lớn của tầm nhìn.

### Trường hợp: chuyển động biên độ lớn chỉ tồn tại khi được cho phép

```tsx
<div className="relative h-64 overflow-hidden rounded-xl border">
  <div
    className="absolute inset-0 bg-neutral-100 motion-safe:transition-transform motion-safe:duration-300
               motion-safe:ease-in-out motion-safe:data-[active]:scale-105"
    data-active={isActive || undefined}
  />
</div>
```

Phóng nền là thứ nếu mất đi thì không ai mất thông tin. Nên nó **mặc định không tồn tại**, và chỉ
xuất hiện với người chưa xin bớt.

### Trường hợp: đọc tuỳ chọn trong luồng lệnh, không chỉ trong class CSS

```tsx
const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

element.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
```

Class CSS chỉ phủ được chuyển động khai báo bằng CSS. Chuyển động do lệnh gọi ra phải tự hỏi cùng câu
hỏi đó, nếu không `MOTION-5` bị bỏ sót đúng ở chỗ chuyển động lớn nhất.

### Ngoại lệ và nhầm lẫn

- **Đừng đem nội dung ra làm điều kiện của truy vấn này:**

  ```tsx
  {/* SAI */} <section className="motion-reduce:hidden">…biểu đồ tiến độ…</section>
  ```

- **`MOTION-5` không phải chỗ để sửa một mã chọn sai.** Nếu chuyển động chỉ chấp nhận được khi người
  dùng đã tắt nó đi, thì mã ban đầu đã sai và câu trả lời đúng là `MOTION-0`.

---

## Ánh xạ yêu cầu sang một cặp nhịp thời gian

Nêu phần tử, thứ đã đổi và ai gây ra thay đổi. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu
cụ thể rồi dừng. Câu trả lời phải là một chuỗi class CSS hoặc một câu hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Nút sáng lên khi rê chuột | Vật vẫn ở đó, chỉ đổi lớp sơn | `MOTION-2` | `transition-colors duration-150 ease-out motion-reduce:transition-none` |
| Thông báo nổi hiện lên rồi tự tắt | Vật vào cây rồi rời khỏi cây | `MOTION-1` | `transition-opacity duration-200 ease-out` · thoát `duration-100 ease-in` |
| Vùng thu gọn mở ra, đẩy phần dưới xuống | Hình học đổi, đích đã biết | `MOTION-3` | `transition-[grid-template-rows] duration-300 ease-in-out` |
| Mũi tên vùng thu gọn xoay ngược lại | Xoay tại chỗ, không ai phải nhích | `MOTION-2` | `transition-transform duration-150 ease-out` |
| Vòng quay trong nút khi đang gửi | Chờ không có đích | `MOTION-4` | `animate-spin motion-reduce:animate-none` |
| Thanh tiến trình chạy tới 62% | Đích đã biết lúc bắt đầu | `MOTION-3` | `transition-[width] duration-300 ease-in-out` |
| Con số thống kê tự cập nhật | Chữ để đọc, không để bám theo | `MOTION-0` | không class CSS chuyển tiếp |
| Luồng tin chèn bản ghi mới từ máy chủ | Người dùng không yêu cầu, đang trỏ chuột | `MOTION-0` | không class CSS chuyển tiếp |
| Cuộn mượt tới phần được chọn | Chuyển động phủ vùng lớn, phải xin phép | `MOTION-5` | `scroll-auto motion-safe:scroll-smooth` |
| Cho thẻ "sinh động lên một chút" | Không trả lời câu hỏi nào của người dùng | `MOTION-0` | không class CSS chuyển tiếp |
| Hàng nhảy sang vị trí mới sau khi bấm sắp xếp | Người dùng gây ra, cần tin là cùng một vật | `MOTION-3` | `transition-transform duration-300 ease-in-out` |

Ở dòng "cho thẻ sinh động lên", câu hỏi phân định **chỉ** được hỏi khi bên yêu cầu nói rõ họ cần một
chuyển động: *"Chuyển động này trả lời câu hỏi nào của người dùng mà lớp sơn tĩnh chưa trả lời
được?"* Nếu không có câu trả lời, mã vẫn là `MOTION-0`.

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `MOTION-0` / `MOTION-2` | Thay đổi này có phải câu trả lời cho một hành vi của người dùng không? |
| `MOTION-0` / `MOTION-3` | Ai gây ra chuyển động — người dùng, hay hệ thống trong lúc họ đang đọc? |
| `MOTION-1` / `MOTION-2` | Vật có tồn tại ở **cả hai** phía của thay đổi không? |
| `MOTION-2` / `MOTION-3` | Có phần tử nào khác phải nhích đi, hoặc vật có tự trượt trong vùng chứa không? |
| `MOTION-3` / `MOTION-4` | Ngay lúc bắt đầu, giá trị cuối cùng đã biết chưa? |
| `MOTION-4` / `MOTION-0` | Khoảng chờ có đủ dài để mắt kịp nhận ra không? |
| `MOTION-5` / mọi mã | Người dùng đã bật `prefers-reduced-motion: reduce` chưa? |

## Sai lầm lặp lại nhiều nhất

1. Viết `transition-all` rồi chọn thời lượng bằng cảm giác.
2. Cho vế vào và vế ra cùng một thời lượng, khiến mọi thao tác đóng bị trả thêm thời gian.
3. Đặt `transition` lên vòng tiêu điểm, biến một chỉ báo trợ năng thành hiệu ứng.
4. Dùng vòng quay bất định trong khi đã có phần trăm thật.
5. Cho `duration-300` vào một rê chuột, hoặc `duration-700` vào một khung lớn.
6. Chạy `top` / `left` / `margin` thay vì `transform`.
7. Để chuyển động là dấu hiệu duy nhất của một trạng thái.
8. Gỡ chuyển động dưới `reduce` mà không để lại chỉ báo tĩnh nào.
9. Cho vật chạy khi chính hệ thống, chứ không phải người dùng, vừa gây ra thay đổi.
10. Đặt class CSS chuyển tiếp cạnh `hidden` và tưởng rằng nó chạy.
