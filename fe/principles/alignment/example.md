---
id: fe-principles-alignment-example
title: example.md
slug: /fe/principles/alignment/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp và ngoại lệ của từng mã ALIGN-N, viết bằng className thuần.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `alignment` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **mã đánh dấu thường với `className` thường**. Không thư viện thành phần, không thiết kế
hệ thống riêng, không khoá đăng ký. Một luật chỉ đúng khi nó đúng ở bất kỳ giao diện nào — nên nếu một
ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó sai chỗ.

Mỗi mã có **nhiều trường hợp**, rồi tới **ngoại lệ** và **những thứ trông giống nhưng không phải mã đó**.
Phần cuối trang ánh xạ từ yêu cầu bằng lời sang class CSS.

Một điều phải nhớ trước khi đọc: **mã trục chéo và mã trục chính cùng có mặt trên một nút DOM**. Đó
không phải hai mã tranh nhau một chỗ — đó là hai câu hỏi khác nhau, mỗi câu một câu trả lời.

---

## `ALIGN-0` — dùng chung một chiều đo, không khai báo

### Trường hợp: hai cột thẻ phải cao bằng nhau

```tsx
<div className="grid gap-4 sm:grid-cols-2">
  <article className="rounded-lg border p-4">
    <h3 className="font-medium">Gói cơ bản</h3>
    <p className="text-sm text-neutral-500">Đủ cho một người dùng.</p>
  </article>
  <article className="rounded-lg border p-4">
    <h3 className="font-medium">Gói nhóm</h3>
    <p className="text-sm text-neutral-500">Chia hạn mức cho tối đa mười thành viên, kèm báo cáo sử dụng hằng tháng.</p>
  </article>
</div>
```

Không khai báo gì. Hai thẻ có nội dung dài ngắn khác nhau nhưng **cùng vẽ một viền**, và viền ngắn
hơn viền bên cạnh sẽ nói dối rằng hai lựa chọn không ngang hàng.

### Trường hợp: hai vùng của một màn hình chia đôi

```tsx
<div className="flex gap-8">
  <aside className="w-64 border-r pr-8">…bộ lọc…</aside>
  <section className="min-w-0 flex-1">…kết quả…</section>
</div>
```

Đường kẻ bên phải thanh dọc chỉ đúng khi thanh dọc cao bằng vùng kết quả. Đó là `ALIGN-0` làm việc.

### Trường hợp: ô trong một dòng bảng

```tsx
<div className="grid grid-cols-[1fr_auto] gap-4">
  <div className="rounded-md bg-neutral-50 p-3">Tên khoá</div>
  <div className="rounded-md bg-neutral-50 p-3">Trạng thái</div>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Không viết `items-stretch`.** Mặc định đã nói đúng điều đó.

  ```tsx
  {/* SAI */}  <div className="flex items-stretch gap-4">…</div>
  {/* ĐÚNG */} <div className="flex gap-4">…</div>
  ```

- **Biểu tượng bị kéo dãn là dấu hiệu `ALIGN-0` dùng nhầm:**

  ```tsx
  {/* SAI — icon 16px bị kéo cao bằng cả đoạn văn */}
  <div className="flex gap-2">
    <svg aria-hidden="true" className="size-4" />
    <p className="text-sm">Bài nộp của bạn đã được ghi nhận và đang chờ chấm trong hàng đợi.</p>
  </div>
  ```

  Ở đây `size-4` cứu biểu tượng khỏi bị kéo, nhưng nó vẫn treo ở mép trên **vì tình cờ**, không vì ai
  quyết. Mã đúng là `ALIGN-2` và phải được viết ra.

- **Cần cao bằng nhau không có nghĩa là cần rộng bằng nhau.** Con phải rộng bằng anh em nó là chuyện
  của `flex-1` và rãnh lưới, không phải của mô-đun này.

---

## `ALIGN-1` — cao thấp khác nhau, đọc thành một dòng

### Trường hợp: biểu tượng và nhãn trong một nút

```tsx
<button className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm" type="button">
  <svg aria-hidden="true" className="size-4" />
  Tải bản ghi
</button>
```

### Trường hợp: ảnh đại diện và tên một dòng

```tsx
<div className="flex items-center gap-2">
  <span className="size-8 shrink-0 rounded-full bg-neutral-200" />
  <span className="truncate font-medium">Nguyễn Văn An</span>
</div>
```

Tên đã `truncate` nên **chắc chắn** một dòng. Đó là điều kiện làm `ALIGN-1` hợp lệ ở đây.

### Trường hợp: nhãn cài đặt và công tắc

```tsx
<div className="flex items-center justify-between gap-4 py-3">
  <span className="text-sm">Nhận thông báo qua email</span>
  <span className="h-6 w-11 shrink-0 rounded-full bg-neutral-300" role="switch" aria-checked="false" />
</div>
```

Hai mã trên một nút DOM: trục chéo `ALIGN-1` vì công tắc là hộp cố định; trục chính `ALIGN-9` vì nhãn và
công tắc là hai vai trò đối nghịch.

### Trường hợp: tiêu đề và nhãn trạng thái trạng thái

```tsx
<div className="flex items-center gap-2">
  <h3 className="font-medium">Hoá đơn tháng 8</h3>
  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Chờ thanh toán</span>
</div>
```

Nhãn trạng thái có **nền riêng**. Nền là một hộp, và hộp thì treo vào giữa chứ không vào dòng viết.

### Trường hợp: một ô vuông chỉ chứa chữ viết tắt

```tsx
<span className="grid size-10 place-items-center rounded-full bg-neutral-100 text-sm font-medium">AN</span>
```

`place-items-center` là cách một lưới chỉ có một con trả lời **cả hai** trục bằng một class CSS. Đây là
idiom duy nhất trong mô-đun này gộp hai câu trả lời, và nó chỉ đúng khi vùng chứa có **đúng một** con
và một kích thước cố định.

### Trường hợp: hàng chỉ số có biểu tượng xu hướng

```tsx
<div className="flex items-center gap-2">
  <span className="text-2xl font-semibold tabular-nums">1.284</span>
  <svg aria-hidden="true" className="size-4 text-emerald-600" />
</div>
```

Con số và **một hình** — có hình thì là `ALIGN-1`, dù bên cạnh là chữ số.

### Ngoại lệ và nhầm lẫn

- **Chữ khác cỡ mà không có hình ⇒ `ALIGN-4`, không phải `ALIGN-1`:**

  ```tsx
  {/* SAI — chân chữ lệch nhau, cụm đọc thành hai thứ */}
  <div className="flex items-center gap-1">
    <span className="text-2xl font-semibold tabular-nums">42</span>
    <span className="text-sm text-neutral-500">bài</span>
  </div>

  {/* ĐÚNG */}
  <div className="flex items-baseline gap-1">
    <span className="text-2xl font-semibold tabular-nums">42</span>
    <span className="text-sm text-neutral-500">bài</span>
  </div>
  ```

- **Chữ có thể xuống dòng ⇒ `ALIGN-2`:**

  ```tsx
  {/* SAI — avatar trôi xuống giữa khi bình luận dài ra */}
  <div className="flex items-center gap-3">
    <span className="size-8 shrink-0 rounded-full bg-neutral-200" />
    <p className="text-sm">Phần giải thích về hàng đợi retry rất rõ, nhưng mình vẫn chưa hình dung được lúc nào nên bỏ hẳn message.</p>
  </div>
  ```

- **`items-center` trên phần tử không phải flex là class CSS chết:**

  ```tsx
  {/* SAI — không có flex, class không render gì */}
  <div className="items-center gap-2">…</div>
  ```

- **`items-center` không căn chữ.** Muốn chữ nằm giữa hộp của chính nó thì đó là căn chữ, và thường
  phải viết cả hai:

  ```tsx
  <div className="flex min-h-24 items-center justify-center">
    <p className="text-center text-sm text-neutral-500">Chưa có dữ liệu cho khoảng thời gian này.</p>
  </div>
  ```

---

## `ALIGN-2` — mỗi con có chiều dài riêng, bắt đầu cùng nhau

### Trường hợp: ảnh đại diện và một bình luận nhiều dòng

```tsx
<div className="flex items-start gap-3">
  <span className="size-8 shrink-0 rounded-full bg-neutral-200" />
  <div className="min-w-0 flex flex-col gap-1">
    <strong className="text-sm">Nguyễn Văn An</strong>
    <p className="text-sm text-neutral-600">Phần giải thích về hàng đợi retry rất rõ, nhưng mình vẫn chưa hình dung được lúc nào nên bỏ hẳn message.</p>
  </div>
</div>
```

Ảnh đại diện neo vào **dòng đầu tiên**. Bình luận dài bao nhiêu cũng không kéo nó xuống.

### Trường hợp: khối nhấn mạnh có biểu tượng, tiêu đề và mô tả

```tsx
<div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
  <svg aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-700" />
  <div className="flex flex-col gap-1">
    <strong className="text-sm text-amber-900">Phương thức thanh toán sắp hết hạn</strong>
    <p className="text-sm text-amber-800">Thẻ kết thúc bằng 4242 hết hạn vào tháng sau. Cập nhật trước ngày gia hạn để không gián đoạn quyền truy cập.</p>
  </div>
</div>
```

`mt-0.5` ở đây **không** phải khoảng cách giữa các phần tử giữa các phần tử cùng cấp — nó bù phần đệm trên của hộp chữ để tâm biểu tượng
khớp dòng đầu. Nếu phải chỉnh quá một nấc như vậy thì mã đã chọn sai.

### Trường hợp: hộp kiểm và điều khoản dài

```tsx
<label className="flex items-start gap-2 text-sm">
  <input className="mt-0.5 size-4 shrink-0" type="checkbox" />
  <span>Tôi đồng ý với điều khoản dịch vụ và cho phép lưu tiến độ học tập của mình để đồng bộ giữa các thiết bị.</span>
</label>
```

### Trường hợp: số thứ tự và câu hỏi dài

```tsx
<li className="flex items-start gap-3">
  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-neutral-100 text-xs tabular-nums">3</span>
  <p className="text-sm">Vì sao một hàng đợi có bảo đảm giao ít nhất một lần vẫn buộc phía nhận phải tự chống trùng?</p>
</li>
```

Mã lồng mã: cha là `ALIGN-2`, còn ô số bên trong là một lưới một con trả lời cả hai trục bằng
`place-items-center` — tức `ALIGN-1`.

### Trường hợp: một cột dạt về mép đầu

```tsx
<div className="flex flex-col items-start gap-2">
  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">Đang học</span>
  <h3 className="font-medium">Thiết kế hệ thống chịu tải</h3>
</div>
```

Đây là **cột**, nên trục chéo là chiều ngang. Không có `items-start`, nhãn trạng thái sẽ bị kéo rộng bằng cả
tiêu đề và cái nền bo tròn của nó trở thành một dải vô nghĩa.

### Ngoại lệ và nhầm lẫn

- **Chữ chắc chắn một dòng ⇒ về `ALIGN-1`.** `items-start` cho một hàng toàn thứ một dòng sẽ đẩy mọi
  thứ lên mép trên và trông lệch, vì các hộp chữ cao thấp khác nhau.
- **`items-start` trong một cột không phải "canh trái".** Nó là "dạt về mép đầu theo hướng đọc", nên
  đúng cả trong ngôn ngữ viết từ phải sang.
- **Không dùng `mt-*` để giả lập `items-start`:**

  ```tsx
  {/* SAI — bù bằng tay cho một quyết định chưa được nêu */}
  <div className="flex gap-3">
    <span className="mt-1 size-8 rounded-full bg-neutral-200" />
    <p className="text-sm">…</p>
  </div>
  ```

---

## `ALIGN-3` — mỗi con có chiều dài riêng, kết thúc cùng nhau

### Trường hợp: cột giá dạt về mép cuối

```tsx
<div className="flex items-center justify-between gap-4 p-4">
  <div className="min-w-0 flex flex-col gap-1">
    <span className="truncate font-medium">Gói nhóm — thanh toán năm</span>
    <span className="text-sm text-neutral-500">Gia hạn ngày 12/09</span>
  </div>
  <div className="flex shrink-0 flex-col items-end gap-1">
    <span className="font-semibold tabular-nums">4.990.000đ</span>
    <span className="text-xs text-neutral-500">đã gồm thuế</span>
  </div>
</div>
```

Cột bên phải là `ALIGN-3`: hai dòng số phải **kết thúc cùng nhau** thì mắt mới so được. Cả hàng ngoài
là `ALIGN-1` trên trục chéo và `ALIGN-9` trên trục chính.

### Trường hợp: cụm hành động dạt mép cuối trong một cột

```tsx
<div className="flex flex-col items-end gap-2">
  <button className="rounded-md border px-3 py-2 text-sm" type="button">Tải hoá đơn</button>
  <span className="text-xs text-neutral-500">PDF · 84 KB</span>
</div>
```

### Trường hợp: các cột biểu đồ mọc từ một sàn

```tsx
<div className="flex h-32 items-end gap-2">
  <div className="w-6 rounded-t bg-neutral-800" style={{ height: "40%" }} />
  <div className="w-6 rounded-t bg-neutral-800" style={{ height: "72%" }} />
  <div className="w-6 rounded-t bg-neutral-800" style={{ height: "100%" }} />
  <div className="w-6 rounded-t bg-neutral-800" style={{ height: "55%" }} />
</div>
```

Đây là trường hợp hiếm hoi mà `items-end` trong một **hàng** là đúng: các con không phải chữ, và cái sàn
chung mới là thứ mang nghĩa.

### Ngoại lệ và nhầm lẫn

- **Trong một hàng chữ, `items-end` gần như luôn là `items-baseline` viết nhầm:**

  ```tsx
  {/* SAI — cùng đáy hộp, không cùng chân chữ */}
  <div className="flex items-end gap-1">
    <span className="text-3xl font-semibold tabular-nums">4,9</span>
    <span className="text-sm text-neutral-500">/ 5</span>
  </div>

  {/* ĐÚNG */}
  <div className="flex items-baseline gap-1">
    <span className="text-3xl font-semibold tabular-nums">4,9</span>
    <span className="text-sm text-neutral-500">/ 5</span>
  </div>
  ```

- **Dồn cả cụm xuống đáy một cột là trục chính, không phải trục chéo:**

  ```tsx
  {/* Trục chéo: các con dạt mép cuối. Trục chính: cụm dồn xuống đáy. */}
  <div className="flex h-full flex-col items-end justify-end gap-2">…</div>
  ```

- **`items-end` không làm số thẳng cột.** Số thẳng cột là việc của chữ số cùng bề rộng.

---

## `ALIGN-4` — chữ khác cỡ đứng trên một dòng viết

### Trường hợp: con số và đơn vị của nó

```tsx
<div className="flex items-baseline gap-1">
  <span className="text-3xl font-semibold tabular-nums">128</span>
  <span className="text-sm text-neutral-500">bài đã hoàn thành</span>
</div>
```

Đây là lý do tồn tại của mã này: hai mẩu chữ khác cỡ **đứng chung một chân** thì đọc thành **một giá
trị**. Treo vào giữa hộp thì nhãn nhỏ trôi lên và cụm đọc thành hai mẩu tin.

### Trường hợp: giá và chu kỳ

```tsx
<p className="flex items-baseline gap-1">
  <span className="text-2xl font-semibold tabular-nums">499.000đ</span>
  <span className="text-sm text-neutral-500">mỗi tháng</span>
</p>
```

### Trường hợp: giá hiện tại, giá gạch và mức giảm

```tsx
<div className="flex flex-wrap items-baseline gap-2">
  <span className="text-xl font-semibold tabular-nums">799.000đ</span>
  <span className="text-sm text-neutral-500 line-through tabular-nums">999.000đ</span>
  <span className="text-sm font-medium text-emerald-700">-20%</span>
</div>
```

Cả ba đều là **chữ**, kể cả mức giảm — nó không có nền, nên không phải một hộp. Nếu mức giảm được cho
một nền bo tròn thì cả hàng chuyển sang `ALIGN-1`.

### Trường hợp: điểm và thang điểm

```tsx
<div className="flex items-baseline gap-1">
  <span className="text-2xl font-semibold tabular-nums">8,5</span>
  <span className="text-sm text-neutral-500">trên 10</span>
</div>
```

### Trường hợp: tiêu đề và số đếm bên cạnh

```tsx
<h2 className="flex items-baseline gap-2">
  <span className="text-base font-semibold">Bình luận</span>
  <span className="text-sm font-normal text-neutral-500 tabular-nums">24</span>
</h2>
```

### Trường hợp: mã lồng mã — hàng chỉ số trong một thẻ

```tsx
<article className="rounded-lg border p-4">
  <div className="flex items-start justify-between gap-4">
    <div className="flex flex-col gap-1">
      <span className="text-sm text-neutral-500">Doanh thu tháng này</span>
      <span className="flex items-baseline gap-1">
        <span className="text-3xl font-semibold tabular-nums">62,4</span>
        <span className="text-sm text-neutral-500">triệu đồng</span>
      </span>
    </div>
    <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
      <svg aria-hidden="true" className="size-3" />
      12%
    </span>
  </div>
</article>
```

Ba mã trong một cây: hàng ngoài là `ALIGN-2` trên trục chéo (cụm bên trái có thể dài ra) và `ALIGN-9`
trên trục chính (nhãn và biến động là hai vai trò đối nghịch); cụm số là `ALIGN-4`; nhãn trạng thái biến động
là `ALIGN-1` vì trong nó có một hình.

### Ngoại lệ và nhầm lẫn

- **Có hình trong hàng ⇒ `ALIGN-1`:**

  ```tsx
  {/* SAI — icon treo vào chân chữ nên tụt thấp hơn chỗ mắt chờ đợi */}
  <div className="flex items-baseline gap-2">
    <svg aria-hidden="true" className="size-4" />
    <span className="text-sm">Đã xác minh</span>
  </div>
  ```

- **Một con là đoạn nhiều dòng thì dòng viết chung chỉ còn là dòng đầu của nó.** Đúng khi đó là câu
  tiếp diễn; sai khi đó là một khối riêng — lúc ấy hai thứ không cùng một dòng viết và mã là
  `ALIGN-2`.
- **`items-baseline` trong một cột không có nghĩa.** Trục chéo của cột là chiều ngang, và chiều ngang
  không có dòng viết để treo vào.

  ```tsx
  {/* SAI */}  <div className="flex flex-col items-baseline gap-1">…</div>
  ```

---

## `ALIGN-5` — một con đi chệch khỏi luật của cha

### Trường hợp: phần chữ neo mép trên, nút neo giữa

```tsx
<div className="flex items-start justify-between gap-4">
  <div className="flex flex-col gap-1">
    <strong className="text-sm">Hạn mức truy vấn hằng tháng</strong>
    <p className="text-sm text-neutral-500">Đặt lại vào ngày đầu mỗi chu kỳ thanh toán. Vượt hạn mức sẽ tính theo đơn giá lẻ.</p>
  </div>
  <button className="shrink-0 self-center rounded-md border px-3 py-2 text-sm" type="button">Nâng hạn mức</button>
</div>
```

Cha vẫn là `ALIGN-2` và vẫn khai báo `items-start` — luật của nó **đúng** cho phần chữ. Đúng một con
nói ra rằng nó không bị ràng buộc.

### Trường hợp: một ô lưới tự kéo hết chiều cao

```tsx
<div className="grid items-start gap-4 sm:grid-cols-3">
  <div className="rounded-lg border p-4">…tóm tắt…</div>
  <div className="rounded-lg border p-4">…ghi chú…</div>
  <div className="self-stretch rounded-lg border p-4">…dòng thời gian, phải chạy hết chiều cao hàng…</div>
</div>
```

### Trường hợp: một biểu tượng không bị kéo trong hàng các cột cao đều

```tsx
<div className="flex gap-4">
  <section className="min-w-0 flex-1 rounded-lg border p-4">…nội dung…</section>
  <button className="self-start rounded-md border p-2" type="button" aria-label="Đóng">
    <svg aria-hidden="true" className="size-4" />
  </button>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Từ hai con đi chệch trở lên ⇒ luật của cha sai:**

  ```tsx
  {/* SAI — hai self-center nghĩa là cha lẽ ra phải là items-center */}
  <div className="flex items-start gap-3">
    <span className="self-center …" />
    <span className="self-center …" />
    <p className="text-sm">…</p>
  </div>
  ```

- **`self-*` không thay cho việc cha khai báo mã của mình.** Một cha không khai báo gì rồi rắc
  `self-*` lên vài con là một cha chưa trả lời câu hỏi trục chéo.
- **Một con nhảy sang mép cuối trên trục chính không phải `ALIGN-5`.** Đó là một con dùng khoảng
  trắng tự động để tự đẩy mình, thuộc luật lề ngoài, và nó **không** đổi câu trả lời trục chính của
  vùng chứa.

---

## `ALIGN-6` — cụm bắt đầu ở mép nội dung, không khai báo

### Trường hợp: một dải nhãn nhỏ lọc

```tsx
<div className="flex flex-wrap items-center gap-2">
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Tất cả</button>
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Đang học</button>
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Đã xong</button>
</div>
```

Chỗ trống sau nhãn nhỏ cuối cùng không mang nghĩa gì, nên không ai phải khai báo nó thuộc về đâu.

### Trường hợp: đường dẫn phân cấp

```tsx
<nav className="flex items-center gap-2 text-sm text-neutral-500">
  <a href="#a">Danh mục</a>
  <span aria-hidden="true">/</span>
  <a href="#b">Hệ thống phân tán</a>
  <span aria-hidden="true">/</span>
  <span className="text-neutral-900">Hàng đợi tin nhắn</span>
</nav>
```

### Trường hợp: hàng thẻ phân loại

```tsx
<ul className="flex flex-wrap items-center gap-2">
  <li className="rounded bg-neutral-100 px-2 py-0.5 text-xs">nền tảng</li>
  <li className="rounded bg-neutral-100 px-2 py-0.5 text-xs">hàng đợi</li>
  <li className="rounded bg-neutral-100 px-2 py-0.5 text-xs">độ trễ</li>
</ul>
```

### Ngoại lệ và nhầm lẫn

- **Không viết `justify-start`:**

  ```tsx
  {/* SAI */}  <div className="flex items-center justify-start gap-2">…</div>
  {/* ĐÚNG */} <div className="flex items-center gap-2">…</div>
  ```

- **Đừng dùng `justify-between` chỉ để đẩy con cuối đi.** Xem `ALIGN-9`.
- **Đừng dùng `justify-*` để tạo khoảng cách.** Khoảng cách giữa các con là `gap` của cha; `justify-*`
  chỉ tiêu chỗ **thừa** và không có gì để tiêu khi vùng chứa vừa khít nội dung.

---

## `ALIGN-7` — cả cụm thuộc về mép cuối

### Trường hợp: nhóm nút ở chân một hộp thoại

```tsx
<footer className="flex items-center justify-end gap-2 border-t p-4">
  <button className="rounded-md border px-3 py-2 text-sm" type="button">Huỷ</button>
  <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="submit">Xác nhận xoá</button>
</footer>
```

Thêm một nút nữa thì nó cũng đứng **cạnh** hai nút này ở mép cuối — đó là phép thử phân biệt với
`ALIGN-9`.

### Trường hợp: phân trang dạt mép cuối

```tsx
<div className="flex items-center justify-end gap-2 pt-4">
  <button className="rounded-md border px-2 py-1 text-sm" type="button">Trước</button>
  <span className="text-sm tabular-nums text-neutral-500">3 / 12</span>
  <button className="rounded-md border px-2 py-1 text-sm" type="button">Sau</button>
</div>
```

### Trường hợp: dồn cụm hành động xuống đáy một thẻ cao đều

```tsx
<article className="flex h-full flex-col justify-end gap-3 rounded-lg border p-4">
  <div className="flex flex-1 flex-col gap-1">
    <h3 className="font-medium">Thiết kế hệ thống chịu tải</h3>
    <p className="text-sm text-neutral-500">Mười hai bài, kèm bốn thử thách thực hành.</p>
  </div>
  <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="button">Vào học</button>
</article>
```

Đây là **cột**, nên "mép cuối" là đáy. Trục chính của một cột nói trên dưới, không nói trái phải.

### Ngoại lệ và nhầm lẫn

- **Một con trong nhiều con phải sang cuối thì không phải `ALIGN-7`:**

  ```tsx
  {/* SAI — cả cụm bị đẩy, kể cả breadcrumb lẽ ra phải ở mép đầu */}
  <div className="flex items-center justify-end gap-2">
    <span className="text-sm text-neutral-500">Danh mục / Hàng đợi</span>
    <button type="button">Lưu</button>
  </div>
  ```

  Ở đây đường dẫn phân cấp thuộc về mép đầu, chỉ nút mới thuộc về mép cuối. Vùng chứa vẫn là `ALIGN-6`, và
  nút tự đẩy mình bằng khoảng trắng tự động.

- **`justify-end` không phải "canh phải".** Nó theo hướng đọc, nên trong ngôn ngữ viết từ phải sang
  nó là mép trái — và đó là điều đúng đắn.

---

## `ALIGN-8` — cụm không thuộc về mép nào

### Trường hợp: trạng thái rỗng

```tsx
<div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed">
  <div className="flex flex-col items-center gap-2">
    <p className="text-sm font-medium">Chưa có bài nộp nào</p>
    <p className="text-sm text-neutral-500">Nộp bài đầu tiên để bắt đầu theo dõi tiến độ.</p>
  </div>
</div>
```

Cụm bên trong cũng là `ALIGN-1` trên trục chéo của một cột — tức dạt vào giữa theo chiều ngang. Hai
nút DOM, hai câu trả lời, cùng một tên class CSS nhưng **khác nghĩa** vì hướng chảy khác nhau.

### Trường hợp: một vùng đang tải

```tsx
<div className="flex min-h-32 items-center justify-center">
  <span className="size-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
</div>
```

### Trường hợp: một CTA đơn độc giữa một dải

```tsx
<div className="flex justify-center border-t pt-6">
  <button className="rounded-md border px-4 py-2 text-sm" type="button">Tải thêm</button>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Cha không phải flex thì mô-đun này không nói gì:**

  ```tsx
  {/* Đây là căn giữa một khối có bề rộng giới hạn — việc của margin, không phải của alignment */}
  <div className="mx-auto max-w-2xl">…</div>
  ```

- **Căn giữa hộp không căn giữa chữ:**

  ```tsx
  {/* Hộp đã ra giữa, nhưng chữ nhiều dòng bên trong vẫn canh mép đầu */}
  <div className="flex justify-center">
    <p className="max-w-sm text-center text-sm text-neutral-500">Chưa có dữ liệu cho khoảng thời gian này. Chọn một khoảng khác hoặc bỏ bớt bộ lọc.</p>
  </div>
  ```

- **Nội dung tiếp nối luồng đọc thì ở lại mép đọc.** Một dòng tóm tắt kết quả không ra giữa chỉ vì
  vùng chứa nó rộng.

---

## `ALIGN-9` — chỗ thừa thuộc về khoảng giữa

### Trường hợp: tiêu đề phần nội dung và một hành động

```tsx
<div className="flex items-center justify-between gap-4">
  <h2 className="font-medium">Khoá học của tôi</h2>
  <a className="text-sm text-neutral-500" href="#all">Xem tất cả</a>
</div>
```

Hai vai trò **không đổi chỗ được**: một bên nói vùng này là gì, một bên nói làm gì với nó.

### Trường hợp: tên mục và giá trị trong một dòng danh sách

```tsx
<li className="flex items-center justify-between gap-4 p-4">
  <span className="min-w-0 truncate">Số lần gọi API</span>
  <span className="shrink-0 tabular-nums">18.402</span>
</li>
```

### Trường hợp: hai đầu của một luồng nhiều bước

```tsx
<div className="flex items-center justify-between gap-4 border-t pt-4">
  <button className="rounded-md border px-3 py-2 text-sm" type="button">Quay lại</button>
  <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="button">Tiếp tục</button>
</div>
```

Thêm một chỉ báo bước vào giữa là **hợp lý** — đó chính là bằng chứng hai đầu đối nghịch.

### Trường hợp: một dải điều hướng chia đều

```tsx
<nav className="flex items-center justify-evenly border-t py-2">
  <a className="flex flex-col items-center gap-1 text-xs" href="#a"><span className="size-5 rounded bg-neutral-300" />Trang chủ</a>
  <a className="flex flex-col items-center gap-1 text-xs" href="#b"><span className="size-5 rounded bg-neutral-300" />Khoá học</a>
  <a className="flex flex-col items-center gap-1 text-xs" href="#c"><span className="size-5 rounded bg-neutral-300" />Hồ sơ</a>
</nav>
```

`evenly` vì ba mục **ngang quyền**: không mục nào có lý do được nhiều lề hơn mục khác.

### Trường hợp: nhãn hai cực của một thanh đo

```tsx
<div className="flex flex-col gap-1">
  <div className="h-2 rounded-full bg-neutral-200"><div className="h-2 w-2/3 rounded-full bg-neutral-900" /></div>
  <div className="flex items-baseline justify-between text-xs text-neutral-500">
    <span>0</span>
    <span className="tabular-nums">2.000 điểm</span>
  </div>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Đây là lỗi nặng nhất của cả mô-đun — dùng `justify-between` để đẩy một con:**

  ```tsx
  {/* SAI — khi badge không render, tiêu đề và nút văng ra hai mép */}
  <div className="flex items-center justify-between gap-2">
    <h3 className="font-medium">Hoá đơn tháng 8</h3>
    {isOverdue && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs">Quá hạn</span>}
    <button type="button">Thanh toán</button>
  </div>
  ```

  Phép thử: con thứ ba có chỗ đứng chính đáng **ở giữa** không? Nhãn trạng thái thì có — nó thuộc về tiêu đề,
  không thuộc về khoảng giữa. Nên mã đúng là `ALIGN-6`, nhãn trạng thái đi cùng tiêu đề trong một cụm, và nút
  tự đẩy mình:

  ```tsx
  {/* ĐÚNG */}
  <div className="flex items-center gap-2">
    <h3 className="font-medium">Hoá đơn tháng 8</h3>
    {isOverdue && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs">Quá hạn</span>}
    <button className="ms-auto" type="button">Thanh toán</button>
  </div>
  ```

- **`justify-between` không tạo khoảng cách.** Trong một cột hẹp, nội dung lấp đầy vùng chứa và class CSS
  này không làm gì cả:

  ```tsx
  {/* Chạy đúng trên bản mô phỏng rộng, phẳng lì trong một cột hẹp */}
  <div className="flex justify-between">
    <span>Nhãn</span>
    <span>Giá trị</span>
  </div>
  ```

  Nếu hai thứ **luôn** phải cách nhau một khoảng thì đó là `gap`, không phải `justify-between`.

- **`around` chỉ đúng khi giải thích được vì sao mép ngoài hẹp hơn khoảng giữa.** Không giải thích
  được thì dùng `evenly`.

---

## `ALIGN-10` — các dòng treo vào đâu

### Trường hợp: dải nhãn nhỏ trong một thanh công cụ cao cố định

```tsx
<div className="flex min-h-20 flex-wrap content-center items-center gap-2 rounded-lg border p-3">
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Nền tảng</button>
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Hàng đợi</button>
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Độ trễ</button>
  <button className="rounded-full border px-3 py-1 text-sm" type="button">Bộ nhớ đệm</button>
</div>
```

Hai câu hỏi khác nhau cùng có mặt: `items-center` nói **các nhãn nhỏ trong một dòng** treo vào giữa dòng;
`content-center` nói **các dòng trong hộp** treo vào giữa hộp. Khi chỉ có một dòng, `content-center`
không làm gì; khi tràn thành hai dòng, nó là thứ giữ cụm đứng giữa thay vì dính mép trên.

### Trường hợp: lưới huy hiệu trong một ô cao cố định

```tsx
<div className="flex h-40 flex-wrap content-start gap-2 rounded-lg border p-3">
  <span className="size-10 rounded-full bg-neutral-200" />
  <span className="size-10 rounded-full bg-neutral-200" />
  <span className="size-10 rounded-full bg-neutral-200" />
</div>
```

`content-start` vì số huy hiệu tăng dần theo thời gian: các dòng phải mọc **xuống dưới** từ một mép
cố định, không nhảy vị trí mỗi lần có thêm một cái.

### Ngoại lệ và nhầm lẫn

- **Không `flex-wrap` thì không có dòng nào để treo:**

  ```tsx
  {/* SAI — class chết, container chỉ có một dòng */}
  <div className="flex content-center gap-2">…</div>
  ```

- **Câu trả lời đúng thường là bỏ chiều cao đi:**

  ```tsx
  {/* Không có chiều cao áp đặt thì không có chỗ thừa, và không cần content-* */}
  <div className="flex flex-wrap gap-2">…</div>
  ```

- **`content-*` không thay `items-*`.** Chúng trả lời hai câu hỏi khác nhau và có thể cùng xuất hiện,
  như trường hợp đầu tiên ở trên.

---

## Ánh xạ yêu cầu sang class CSS

Nêu vùng chứa, hướng chảy và bản chất các con. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu
cụ thể rồi dừng. Câu trả lời phải là một chuỗi class CSS hoặc một câu hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Cho hai thẻ lựa chọn nằm cạnh nhau, viền phải đều nhau | Hai con cùng vẽ ranh giới, phải chung một chiều đo | `ALIGN-0` | `grid gap-4 sm:grid-cols-2` |
| Đặt biểu tượng trước nhãn trong một nút | Có hình trong hàng, hình không được kéo | `ALIGN-1` | `inline-flex items-center gap-2` |
| Ảnh đại diện bên trái, bình luận nhiều dòng bên phải | Chữ dài ra được, ảnh đại diện phải neo dòng đầu | `ALIGN-2` | `flex items-start gap-3` |
| Cột số tiền phải thẳng mép cuối với nhau | Chỗ so sánh là nơi nội dung kết thúc | `ALIGN-3` | `flex flex-col items-end gap-1` |
| Con số to, đơn vị nhỏ, đọc thành một giá trị | Cả hai đều là chữ và phải chung một chân chữ | `ALIGN-4` | `flex items-baseline gap-1` |
| Cả hàng neo mép trên, riêng cái nút thì nằm giữa | Đúng một con đi chệch, luật của cha vẫn đúng | `ALIGN-5` | `items-start` trên cha + `self-center` trên nút |
| Xếp một dải nhãn nhỏ lọc | Chỗ trống sau nhãn nhỏ cuối không mang nghĩa | `ALIGN-6` | `flex flex-wrap items-center gap-2` |
| Nhóm nút ở chân hộp thoại | Cả cụm thuộc về mép cuối, thêm nút vẫn đứng cạnh | `ALIGN-7` | `flex items-center justify-end gap-2` |
| Thông báo "chưa có dữ liệu" giữa một vùng trống | Nội dung nói về cả vùng, không tiếp nối mép nào | `ALIGN-8` | `flex items-center justify-center` |
| Tiêu đề bên này, "Xem tất cả" bên kia | Hai vai trò đối nghịch, không đổi chỗ được | `ALIGN-9` | `flex items-center justify-between gap-4` |
| Đẩy riêng nút thanh toán sang cuối, tiêu đề ở lại đầu | Một con tự đẩy mình; vùng chứa không đổi cách xếp | `ALIGN-6` | `flex items-center gap-2` + `ms-auto` trên nút |
| Dải nhãn nhỏ xuống dòng, nằm giữa một thanh cao cố định | Vùng chứa sở hữu chỗ thừa trục chéo cho các dòng | `ALIGN-10` | `flex min-h-20 flex-wrap content-center items-center gap-2` |
| Căn giữa một khối nội dung rộng tối đa 2xl trong trang | Cha không phải flex — mô-đun này không phát ra gì | — | `mx-auto max-w-2xl` |
| Cho chữ nằm giữa hộp của chính nó | Căn hình dạng ký tự trong hộp, không phải căn hộp trong cha | — | `text-center` |

Dòng thứ mười một chỉ được chọn sau khi trả lời được câu phân định: *"Nếu có con thứ ba, nó có chỗ
đứng chính đáng ở giữa không?"*

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `ALIGN-0` / `ALIGN-2` | Có con nào sở hữu nền, viền hoặc bóng đổ mà việc kéo dãn sẽ nói dối không? |
| `ALIGN-0` / `ALIGN-1` | Có con nào là hình hoặc hộp cố định, kéo dãn thì hỏng không? |
| `ALIGN-1` / `ALIGN-2` | Phần chữ trong hàng **có thể** xuống dòng thứ hai không? |
| `ALIGN-1` / `ALIGN-4` | Mọi con đều là chữ, và đọc to lên thì thành một cụm từ chứ? |
| `ALIGN-2` / `ALIGN-3` | Mắt so sánh chỗ các con **bắt đầu** hay chỗ chúng **kết thúc**? |
| `ALIGN-3` / `ALIGN-4` | Các con là chữ hay là hình? Chữ thì chung chân chữ, hình thì chung sàn. |
| bất kỳ / `ALIGN-5` | Bỏ con này ra thì luật của cha còn đúng cho **tất cả** phần còn lại chứ? |
| `ALIGN-6` / `ALIGN-8` | Nội dung tiếp nối luồng đọc từ một mép, hay nói về cả vùng đang trống? |
| `ALIGN-6` / `ALIGN-9` | Nếu thêm con thứ ba, nó có chỗ đứng chính đáng **ở giữa** không? |
| `ALIGN-7` / `ALIGN-9` | Thêm một con nữa thì nó đứng **cạnh** cụm hiện tại, hay tách sang mép đối diện? |
| `ALIGN-7` / lề ngoài | **Cả cụm** thuộc về mép cuối, hay chỉ **một** con phải nhảy sang đó? |
| `ALIGN-8` / lề ngoài | Cha có thật sự là `flex` hoặc `grid` không? |
| trục chéo / `ALIGN-10` | Vùng chứa có xuống dòng **và** sở hữu chiều đo trục chéo lớn hơn các dòng không? |

## Sai lầm lặp lại nhiều nhất

1. Dùng `justify-between` để đẩy một con sang cuối, rồi bố cục đổi hình khi một con hiển thị có điều
   kiện biến mất.
2. Dùng `items-center` cho một hàng có chữ có thể xuống dòng, khiến ảnh đại diện hoặc biểu tượng trôi xuống giữa
   khi dữ liệu dài ra.
3. Dùng `items-center` cho con số và đơn vị, làm hai chân chữ lệch nhau và cụm đọc thành hai thứ.
4. Viết `items-*` hoặc `justify-*` trên phần tử không phải `flex` hay `grid` — class CSS chết, không
   hiển thị gì.
5. Nhầm căn hộp với căn chữ: viết `items-center` khi cần `text-center`, hoặc ngược lại.
6. Dùng `justify-*` để tạo khoảng cách, rồi hỏng ngay khi vùng chứa không còn rộng hơn nội dung.
7. Viết `items-stretch` hoặc `justify-start`, tức nói lại đúng cái mặc định đã nói.
8. Bù bằng `mt-*` trên con thay vì nêu mã trục chéo của cha.
9. Đổi `flex-row` thành `flex-col` ở điểm ngắt mà quên rằng trục chéo vừa xoay chín mươi độ, nên
   `items-center` đã đổi nghĩa.
10. Rắc `self-*` lên nhiều con thay vì thừa nhận luật của cha đã sai.
