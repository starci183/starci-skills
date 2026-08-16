---
id: fe-principles-optical-example
title: example.md
slug: /fe/principles/optical/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp và ngoại lệ của từng mã OPTICAL-N, viết bằng className thuần.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `optical` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **mã đánh dấu thường với `className` thường**. Không thư viện thành phần, không thiết kế
hệ thống riêng, không khoá đăng ký. Một luật chỉ đúng khi nó đúng ở bất kỳ giao diện nào — nên nếu một
ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó sai chỗ.

Mỗi mã có **nhiều trường hợp**, rồi tới **ngoại lệ** và **những thứ trông giống nhưng không phải mã đó**.
Riêng mô-đun này, mỗi trường hợp còn phải nói ra **phép đo** — con số mà người khác cầm thước kiểm lại được.
Ví dụ nào không nêu được phép đo thì ví dụ đó đang minh hoạ `OPTICAL-0`, không phải mã nó tự nhận.

---

## `OPTICAL-0` — số đo đúng, không nhúc nhích

### Trường hợp: biểu tượng đối xứng trong nút vuông

```tsx
<button className="grid size-9 place-items-center rounded-md border" type="button">
  <svg aria-hidden="true" className="size-4" viewBox="0 0 16 16">
    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" />
  </svg>
  <span className="sr-only">Thêm mục</span>
</button>
```

Dấu cộng đối xứng cả hai trục: sáng trái bằng sáng phải, sáng trên bằng sáng dưới. Không có gì để sửa,
và thêm `translate-x-px` ở đây là **tạo ra** một chênh lệch chứ không xoá chênh lệch nào.

### Trường hợp: ảnh đại diện tròn trong khung tròn

```tsx
<span className="grid size-12 place-items-center rounded-full bg-neutral-100">
  <img alt="" className="size-10 rounded-full object-cover" src="/u/128.jpg" />
</span>
```

Vành 1px đều quanh chu vi vì hai hình tròn đồng tâm sẵn. Đây là chỗ phép trừ của `OPTICAL-5` suy biến,
và suy biến đúng.

### Trường hợp: khoảng đệm trong lớn hơn bán kính ngoài

```tsx
<div className="rounded-lg border p-4">
  <div className="rounded-xl bg-neutral-50 p-4">Tóm tắt đơn hàng</div>
</div>
```

Bán kính ngoài 8px, khoảng đệm trong 16px. Không còn góc nào lồng vào góc nào để đồng tâm, nên bán kính trong
là lựa chọn tự do — `rounded-xl` ở đây không vi phạm gì cả.

### Trường hợp: văn bản nội dung đúng cỡ nó được vẽ cho

```tsx
<p className="max-w-prose text-base leading-7">
  Bài nộp sẽ được chấm trong vòng 24 giờ làm việc kể từ lúc gửi.
</p>
```

### Trường hợp: biểu tượng đã căn quang học sẵn trong viewBox

```tsx
<button className="grid size-10 place-items-center rounded-full bg-neutral-900 text-white" type="button">
  <svg aria-hidden="true" className="size-4" viewBox="0 0 16 16">
    <path d="M5.5 3.5l7 4.5-7 4.5z" fill="currentColor" />
  </svg>
  <span className="sr-only">Phát</span>
</button>
```

Tam giác vẽ từ `x=5.5` tới `x=12.5` trong viewBox rộng 16: sáng trái 5,5 — sáng phải 3,5. Nghe thì
lệch, nhưng trọng tâm của tam giác nằm ở `(5.5+5.5+12.5)/3 ≈ 7,83`, gần đúng tâm 8 của viewBox. Bộ
biểu tượng đã trả tiền cho phép căn này rồi. Đo trước, rồi mới biết đây là `OPTICAL-0` chứ không phải
`OPTICAL-1`.

### Ngoại lệ và nhầm lẫn

- **"Nhìn đỡ hơn" không phải phép đo.** Không có mã nào nhận câu đó.

  ```tsx
  {/* SAI */} <span className="size-2 translate-y-px rounded-full bg-emerald-500" />
  ```

- **Sửa hai lần là nhân đôi sai số.** Biểu tượng đã căn sẵn mà còn thêm `translate` thì lệch thật.

  ```tsx
  {/* SAI */} <svg className="size-4 translate-x-px" viewBox="0 0 16 16" /> {/* trên bộ icon đã căn */}
  ```

- **Không dùng `OPTICAL-0` như một cái cớ để bỏ đo.** `OPTICAL-0` là phán quyết **sau** khi đo, không
  phải trước.

---

## `OPTICAL-1` — tâm tính ra không phải tâm nhìn thấy

### Trường hợp: tam giác phát trong nút tròn

```tsx
<button className="grid size-12 place-items-center rounded-full bg-neutral-900 text-white" type="button">
  <svg aria-hidden="true" className="size-5 translate-x-px" viewBox="0 0 20 20">
    <path d="M5 3l12 7-12 7z" fill="currentColor" />
  </svg>
  <span className="sr-only">Phát bài giảng</span>
</button>
```

**Phép đo.** Tam giác chạy từ `x=5` tới `x=17`; trọng tâm ở `(5+5+17)/3 ≈ 9`, lệch trái 1px so với tâm
viewBox là 10. Sáng trái 5, sáng phải 3. `translate-x-px` xoá đúng chênh lệch đó và không hơn.

### Trường hợp: mũi tên gửi trong nút vuông

```tsx
<button className="grid size-9 place-items-center rounded-md bg-neutral-900 text-white" type="button">
  <svg aria-hidden="true" className="size-4 -translate-y-px translate-x-px" viewBox="0 0 16 16">
    <path d="M2 14L14 8 2 2l2 6-2 6z" fill="currentColor" />
  </svg>
  <span className="sr-only">Gửi</span>
</button>
```

Mũi tên lệch cả hai trục nên có **hai** dấu hiệu, và cả hai đều thuộc `OPTICAL-1` vì cùng một thuộc tính
là vị trí. Đây không phải hai mã.

### Trường hợp: biểu tượng chữ V đuôi làm khoảng đệm trong phải nhìn rộng hơn

```tsx
<button className="inline-flex items-center gap-1.5 rounded-md border py-2 pl-3 pr-2.5 text-sm" type="button">
  Xem tất cả khoá học
  <svg aria-hidden="true" className="size-4" viewBox="0 0 16 16">
    <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
</button>
```

**Phép đo.** Nét biểu tượng chữ V dừng ở `x=10` trong viewBox rộng 16, tức mực cách mép hộp 6/16 × 16px = 6px…
ở cỡ `size-4` là khoảng 1,5px. `pr-3` khai bằng `pl-3` sẽ đọc ra rộng hơn chừng ấy, nên khoảng đệm trong phải
rút xuống `pr-2.5`. Sửa **khoảng đệm trong của vùng chứa**, không phóng to biểu tượng.

### Trường hợp: nút quay lại — cùng dấu hiệu, lật hướng

```tsx
<button className="grid size-9 place-items-center rounded-full border" type="button">
  <svg
    aria-hidden="true"
    className="size-4 -translate-x-px rtl:translate-x-px"
    viewBox="0 0 16 16"
  >
    <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
  <span className="sr-only">Quay lại</span>
</button>
```

Hình dáng phụ thuộc hướng ⇒ ghi đè ngang phải lật ở RTL. Bỏ `rtl:` là đúng ở một hướng và sai ở
hướng còn lại.

### Trường hợp: hộp thoại trong một trường trống rất cao

```tsx
<div className="fixed inset-0 grid place-items-center overflow-y-auto p-4 pb-[12vh]">
  <div className="w-full max-w-md rounded-xl border bg-white p-6">
    <h2 className="text-lg font-semibold">Xác nhận huỷ đăng ký</h2>
  </div>
</div>
```

**Phép đo.** Với một trường cao 900px và hộp thoại cao 200px, canh giữa cho 350px trên và 350px dưới.
Mắt đọc nửa trên ra to hơn, nên tâm quang học nằm cao hơn tâm hình học chừng 4–6% chiều cao trường.
`pb-[12vh]` đẩy hộp thoại lên đúng chừng đó. Đây vẫn là `OPTICAL-1` vì thuộc tính bị sửa là **vị trí
tâm**, chỉ khác là "dấu" ở đây là cả hộp thoại.

### Trường hợp lồng mã: `OPTICAL-1` bên trong `OPTICAL-5`

```tsx
<article className="rounded-2xl border p-2">
  <div className="relative overflow-hidden rounded-lg bg-neutral-100">
    <img alt="" className="aspect-video w-full object-cover" src="/c/1.jpg" />
    <button
      className="absolute inset-0 m-auto grid size-14 place-items-center rounded-full bg-black/60 text-white"
      type="button"
    >
      <svg aria-hidden="true" className="size-6 translate-x-[1.5px]" viewBox="0 0 24 24">
        <path d="M6 4l14 8-14 8z" fill="currentColor" />
      </svg>
      <span className="sr-only">Xem giới thiệu</span>
    </button>
  </div>
  <div className="p-3">
    <h3 className="font-medium">Thiết kế hệ thống phân tán</h3>
  </div>
</article>
```

Hai mã, hai thuộc tính, hai chỗ. Ngoài cùng: bán kính 16px trừ khoảng đệm trong 8px ra `rounded-lg` — `OPTICAL-5`.
Trong cùng: trọng tâm tam giác lệch trái 1,5px ở cỡ 24 — `OPTICAL-1`. Không mã nào giải thích được
chỗ của mã kia, và gộp lại thành "chỉnh cho cân" là mất cả hai phép đo.

### Ngoại lệ và nhầm lẫn

- **Đừng phóng to để chữa lệch.**

  ```tsx
  {/* SAI */}  <svg className="size-6" viewBox="0 0 20 20" />      {/* lệch thì vẫn lệch, chỉ to hơn */}
  {/* ĐÚNG */} <svg className="size-5 translate-x-px" viewBox="0 0 20 20" />
  ```

- **Đừng sửa bằng `margin` một phía trên dấu nằm trong luồng.** `margin` đổi cả chỗ của phần tử cùng cấp; ghi
  đè quang học phải **không** đụng vào khoảng cách giữa các phần tử.

  ```tsx
  {/* SAI */}  <span className="inline-flex items-center gap-2"><svg className="ml-px size-4" />Tải xuống</span>
  {/* ĐÚNG */} <span className="inline-flex items-center gap-2"><svg className="size-4 translate-x-px" />Tải xuống</span>
  ```

- **Chữ lệch không phải `OPTICAL-1`.** Số nằm thấp trong nhãn trạng thái là chuyện của dòng hộp ⇒ `OPTICAL-3`.
- **Quá 2px trên một dấu 16–24px là đổi bố cục,** không còn là quang học. Lúc đó đi hỏi lại cái
  viewBox hoặc cái khoảng đệm trong.

---

## `OPTICAL-2` — hộp bằng nhau, khối lượng không bằng nhau

### Trường hợp: chấm tròn chú giải cạnh ô vuông chú giải

```tsx
<ul className="flex flex-col gap-2 text-sm">
  <li className="flex items-center gap-2">
    <span className="size-2.5 rounded-full bg-neutral-900" />
    Đã hoàn thành
  </li>
  <li className="flex items-center gap-2">
    <span className="size-2 rounded-sm bg-neutral-400" />
    Đang làm dở
  </li>
</ul>
```

**Phép đo.** Hình tròn nội tiếp phủ π/4 ≈ 78,5% diện tích hình vuông cùng cạnh. Muốn hai khối lượng
bằng nhau thì đường kính phải lớn hơn cạnh khoảng 1/√(π/4) ≈ 1,13 lần: hình vuông 8px tương ứng với
hình tròn 9px; làm tròn theo thang kích thước gần nhất là `size-2` và `size-2.5`.

### Trường hợp: biểu tượng cạnh nhãn `text-sm`

```tsx
<span className="inline-flex items-center gap-2 text-sm">
  <svg aria-hidden="true" className="size-[1.125rem]" viewBox="0 0 20 20">
    <path d="M4 5h12v10H4z" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
  Tài liệu đính kèm
</span>
```

**Phép đo.** Hình vẽ chỉ chiếm 12 trong 20 đơn vị chiều cao của viewBox. Ở `size-4` (16px) thì mực cao
9,6px, trong khi cap-chiều cao của `text-sm` khoảng 10px — biểu tượng đọc ra hụt. `size-[1.125rem]` (18px) đưa
mực lên 10,8px và hai khối lượng đọc bằng nhau.

### Trường hợp: trộn biểu tượng nét và biểu tượng đặc trong một thanh công cụ

```tsx
<div className="flex items-center gap-1">
  <button className="grid size-9 place-items-center rounded-md" type="button">
    <svg aria-hidden="true" className="size-4" fill="currentColor" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="5" />
    </svg>
  </button>
  <button className="grid size-9 place-items-center rounded-md" type="button">
    <svg
      aria-hidden="true"
      className="size-4 [stroke-width:1.75]"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 16 16"
    >
      <circle cx="8" cy="8" r="5" />
    </svg>
  </button>
</div>
```

Ở đây thuộc tính được sửa là **bề dày nét**, không phải `size` — vì hai dấu đã bằng nhau về đường kính
mực, chỉ khác lượng mực. Vẫn là `OPTICAL-2`: mã sở hữu khối lượng, không sở hữu riêng thuộc tính `size`.

### Trường hợp: nút tròn cạnh nút bo góc trong một cụm

```tsx
<div className="flex items-center gap-2">
  <button className="grid size-9 place-items-center rounded-md border" type="button">
    <span className="sr-only">Lọc</span>
  </button>
  <button className="grid size-[2.375rem] place-items-center rounded-full border" type="button">
    <span className="sr-only">Hồ sơ</span>
  </button>
</div>
```

**Phép đo.** `size-9` = 36px. Nút tròn cùng 36px phủ 78,5% diện tích nút vuông, nên nâng lên 38px
(`size-[2.375rem]`) để hai nút đọc ra cùng cỡ. Đây là +2px — vẫn nằm trong hạn mức "bước nhỏ nhất xoá
được chênh lệch đo được".

### Trường hợp: ảnh đại diện tròn cạnh ảnh thu nhỏ vuông trong một hàng

```tsx
<li className="flex items-center gap-3">
  <img alt="" className="size-11 rounded-full object-cover" src="/u/1.jpg" />
  <img alt="" className="size-10 rounded-md object-cover" src="/c/1.jpg" />
  <span className="text-sm">Đã nhận xét bài nộp</span>
</li>
```

### Ngoại lệ và nhầm lẫn

- **Biểu tượng lệch chỗ thì dịch, đừng phóng.** Phóng để chữa lệch là chọn sai mã và làm hỏng cả hai.
- **Biểu tượng thấp so với chữ là `OPTICAL-3`, không phải `OPTICAL-2`.** Hỏi trục trước: sai chiều dọc hay
  sai cỡ.
- **Đừng phóng biểu tượng để "cân" với một chữ đậm hơn.** Chữ đậm là quyết định của `font-weight`, và cái
  cần đo là mực của biểu tượng so với **cap-chiều cao**, không phải so với độ đậm.

  ```tsx
  {/* SAI */}  <span className="inline-flex items-center gap-2 text-sm font-semibold"><svg className="size-5" />Lưu</span>
  ```

- **Khung chờ giữ nguyên cỡ đã ghi đè,** nếu không thì bố cục nhảy đúng lúc nội dung về.

  ```tsx
  <span className="inline-flex items-center gap-2">
    <span className="size-[1.125rem] rounded bg-neutral-200" />
    <span className="h-4 w-28 rounded bg-neutral-200" />
  </span>
  ```

---

## `OPTICAL-3` — hộp của chữ không phải mực của chữ

### Trường hợp: nhãn trạng thái số trong ô tròn

```tsx
<span className="grid size-6 place-items-center rounded-full bg-red-600 pb-px text-[11px] font-semibold leading-none tabular-nums text-white">
  3
</span>
```

**Phép đo.** Với `leading-none`, hộp dòng bằng đúng cỡ chữ, nhưng đường chân chữ không nằm giữa hộp: phần
trống dưới đường chân chữ lớn hơn phần trên cap chừng 4% cỡ chữ. Ở 11px là khoảng 0,5px, làm tròn lên bước
kiểm được là 1px ⇒ `pb-px`.

### Trường hợp: nhãn bo tròn chữ hoa

```tsx
<span className="inline-flex items-center rounded-full bg-neutral-900 px-2 pb-[3px] pt-[4px] text-[11px] font-semibold uppercase leading-none tracking-wide text-white">
  Mới
</span>
```

Khoảng đệm trong trên dưới **lệch có chủ đích**: chữ hoa không có descender, nên `py` bằng nhau sẽ đẩy cả dòng
chữ xuống thấp. Chú ý `tracking-wide` ở đây là `OPTICAL-4` chứ không phải `OPTICAL-3` — cùng một thẻ,
hai mã, hai thuộc tính.

### Trường hợp: biểu tượng cạnh một đoạn nhiều dòng

```tsx
<p className="flex gap-2 text-sm leading-6">
  <svg aria-hidden="true" className="mt-[3px] size-4 shrink-0" viewBox="0 0 16 16">
    <circle cx="8" cy="8" fill="none" r="6" stroke="currentColor" strokeWidth="1.5" />
  </svg>
  <span>
    Bài nộp sẽ được chấm trong vòng 24 giờ làm việc, và bạn sẽ nhận được thông báo ngay khi có kết quả.
  </span>
</p>
```

**Phép đo.** `leading-6` = 24px, biểu tượng 16px. Muốn biểu tượng ngang **dòng đầu** thì lề trên bằng
(24 − 16) / 2 = 4px, trừ đi khoảng 1px vì mực biểu tượng chưa chạm mép viewBox ⇒ `mt-[3px]`. Dùng
`items-center` ở đây là canh biểu tượng vào giữa **cả đoạn**, và sai càng nhiều khi đoạn càng dài.

### Trường hợp: chữ hoa và chữ thường trên một dòng

```tsx
<h2 className="flex items-baseline gap-2">
  <span className="text-lg font-semibold">Đơn hàng #10428</span>
  <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">đã thanh toán</span>
</h2>
```

`items-center` sẽ canh hai **hộp dòng**, và vì hai cỡ chữ khác nhau, cụm chữ hoa nhỏ sẽ đọc ra trôi
lên giữa thân chữ lớn. `items-baseline` canh cái mà mắt thật sự đọc.

### Trường hợp: số lớn cạnh đơn vị

```tsx
<p className="flex items-baseline gap-1">
  <span className="text-3xl font-semibold leading-none tabular-nums">128</span>
  <span className="text-sm text-neutral-500">giờ đã học</span>
</p>
```

### Trường hợp: khoảng trống ma phía trên tiêu đề

```tsx
<section className="flex flex-col gap-3">
  <h2 className="text-3xl font-semibold leading-[1.15] tracking-tight">Lộ trình của bạn</h2>
  <p className="text-sm text-neutral-500">Cập nhật hằng tuần theo tiến độ thực tế.</p>
</section>
```

**Phép đo.** `text-3xl` mặc định `leading-9` (36px) trên cỡ 30px: 6px trống chia đôi trên dưới, tức
3px trống phía trên cap mà không ai khai báo. Sửa **trên chữ** bằng `leading-[1.15]`. Tuyệt đối không
sửa bằng cách đổi `gap-3` — khoảng cách giữa các phần tử thuộc luật khoảng cách, và đổi nó là nói dối về quan hệ giữa hai
phần tử cùng cấp.

### Trường hợp: chữ cái đầu trong ảnh đại diện phương án dự phòng

```tsx
<span className="grid size-10 place-items-center rounded-full bg-neutral-100 pb-px text-sm font-medium leading-none">
  AN
</span>
```

### Ngoại lệ và nhầm lẫn

- **Chữ hoa tiếng Việt đội dấu.** Ghi đè đo trên chuỗi không dấu sẽ cắt dấu khi gặp nội dung thật.

  ```tsx
  {/* SAI  — đo trên "PRO", vỡ khi gặp "ĐÃ HOÀN THÀNH" */}
  <span className="rounded-full px-2 pb-0 pt-px text-[11px] uppercase leading-[0.9]">Đã hoàn thành</span>

  {/* ĐÚNG — chừa chỗ cho dấu, vẫn lệch padding để bù descender */}
  <span className="rounded-full px-2 pb-[3px] pt-[4px] text-[11px] uppercase leading-none">Đã hoàn thành</span>
  ```

- **Đừng dùng `leading-none` cho chữ nhiều dòng.** Nó chỉ dành cho một dòng duy nhất trong một hộp.

  ```tsx
  {/* SAI */} <p className="text-sm leading-none">…đoạn văn ba dòng…</p>
  ```

- **Đừng chữa chữ thấp bằng `translate-y` trên vùng chứa.** Vùng chứa mang cả nền và viền; dịch nó là
  dịch luôn hình dạng. Chỉ dịch mực, hoặc lệch khoảng đệm trong.
- **`items-baseline` không phải thuốc chữa mọi thứ.** Biểu tượng không có đường chân chữ; biểu tượng cạnh chữ đi bằng
  `mt-*` đo từ khoảng cách dòng.

---

## `OPTICAL-4` — chữ đang giãn theo một cỡ nó không còn đứng

### Trường hợp: tiêu đề cỡ hiển thị

```tsx
<h1 className="text-5xl font-semibold leading-[1.1] tracking-tight">
  Học theo lộ trình, không học theo danh sách
</h1>
```

**Phép đo.** Khoảng cách giữa hai chữ cái do bộ chữ vẽ giữ nguyên **tỉ lệ** khi cỡ tăng, nhưng mắt đọc
khoảng cách theo tỉ lệ với chiều cao cap. Cùng một tỉ lệ ở 48px đọc ra rộng hơn ở 16px. `tracking-tight`
(−0,025em) kéo về đúng tỉ lệ mà mắt đọc ở cỡ đọc.

### Trường hợp: nhãn chữ hoa cỡ nhỏ

```tsx
<span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
  Tổng quan tuần này
</span>
```

Chiều ngược lại: chữ hoa ở cỡ 10–12px dính thành khối đặc vì không có phần nhô lên nào để mắt bám.

### Trường hợp: số liệu rất lớn

```tsx
<p className="flex items-baseline gap-2">
  <span className="text-6xl font-semibold leading-none tabular-nums tracking-tighter">1.248</span>
  <span className="text-sm text-neutral-500">học viên đang theo học</span>
</p>
```

### Trường hợp: nhãn dẫn trên tiêu đề — hai mã, hai thuộc tính, một khối

```tsx
<div className="flex flex-col gap-2">
  <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Khoá mới</span>
  <h2 className="text-4xl font-semibold leading-[1.15] tracking-tight">Kiến trúc dữ liệu thực chiến</h2>
</div>
```

Một khối, hai chiều ghi đè ngược nhau: nhãn nhỏ nới ra, tiêu đề lớn siết vào. Không có mâu thuẫn nào —
hai phép đo khác nhau trên hai phần tử khác nhau.

### Ngoại lệ và nhầm lẫn

- **Văn bản nội dung ở cỡ đọc là `OPTICAL-0`.**

  ```tsx
  {/* SAI */}  <p className="text-sm tracking-wide">…</p>
  {/* ĐÚNG */} <p className="text-sm">…</p>
  ```

- **Không nới `tracking` lên cột số.** `OPTICAL-6` sở hữu cột, và `tracking` phá lại đúng cái cạnh vừa
  sửa.

  ```tsx
  {/* SAI */}  <td className="text-right tabular-nums tracking-wide">1.240.000</td>
  {/* ĐÚNG */} <td className="text-right tabular-nums">1.240.000</td>
  ```

- **`tracking` không phải cách làm chữ vừa một dòng.** Nếu chuỗi tràn, đó là chuyện của cỡ chữ hoặc
  chiều rộng vùng chứa.

---

## `OPTICAL-5` — góc lồng góc

### Trường hợp: ảnh bìa trong thẻ có khoảng đệm trong

```tsx
<article className="rounded-2xl border p-2">
  <img alt="" className="aspect-video w-full rounded-lg object-cover" src="/c/2.jpg" />
  <div className="px-2 py-3">
    <h3 className="font-medium">Nền tảng hệ thống</h3>
  </div>
</article>
```

Ngoài 16px (`rounded-2xl`), vành 8px (`p-2`) ⇒ trong 8px (`rounded-lg`).

### Trường hợp: nút trong một thanh gộp

```tsx
<div className="inline-flex items-center rounded-lg border p-1">
  <button className="rounded px-3 py-1.5 text-sm" type="button">Tuần</button>
  <button className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white" type="button">Tháng</button>
</div>
```

Ngoài 8px (`rounded-lg`), vành 4px (`p-1`) ⇒ trong 4px (`rounded`).

### Trường hợp: thẻ tab nhãn bo tròn trong danh sách thẻ tab bo góc

```tsx
<div className="inline-flex items-center rounded-xl bg-neutral-100 p-1" role="tablist">
  <button className="rounded-lg px-3 py-1.5 text-sm" role="tab" type="button">Bài học</button>
  <button className="rounded-lg bg-white px-3 py-1.5 text-sm shadow-sm" role="tab" type="button">Thảo luận</button>
</div>
```

Ngoài 12px, vành 4px ⇒ trong 8px.

### Trường hợp: ba tầng lồng nhau

```tsx
<section className="rounded-3xl bg-neutral-50 p-2">
  <div className="rounded-2xl border bg-white p-2">
    <pre className="overflow-x-auto rounded-lg bg-neutral-900 p-4 text-xs text-white">
      GET /api/v1/enrollments
    </pre>
  </div>
</section>
```

24 − 8 = 16; 16 − 8 = 8. Phép trừ chạy suốt chuỗi, và mỗi tầng chỉ cần biết **tầng cha ngay trên nó**.

### Trường hợp: ảnh đại diện có vòng

```tsx
<span className="inline-block rounded-full p-0.5 ring-2 ring-emerald-500">
  <img alt="" className="size-10 rounded-full object-cover" src="/u/2.jpg" />
</span>
```

Hình tròn: phép trừ suy biến, `rounded-full` giữ nguyên ở cả hai tầng.

### Trường hợp lồng mã: `OPTICAL-3` bên trong `OPTICAL-5`

```tsx
<article className="rounded-xl border p-1.5">
  <div className="rounded-md bg-neutral-50 p-3">
    <div className="flex items-center justify-between">
      <h3 className="font-medium">Gói cơ bản</h3>
      <span className="inline-flex items-center rounded-full bg-emerald-600 px-2 pb-[3px] pt-[4px] text-[11px] font-semibold uppercase leading-none tracking-wide text-white">
        Đang dùng
      </span>
    </div>
  </div>
</article>
```

Ngoài: 12 − 6 = 6 ⇒ `rounded-md`, đó là `OPTICAL-5`. Trong nhãn trạng thái: khoảng đệm trong trên dưới lệch để bù phần
trống dưới đường chân chữ, đó là `OPTICAL-3`; `tracking-wide` trên cùng thẻ đó là `OPTICAL-4`. Nhãn trạng thái
`rounded-full` không tham gia phép trừ vì nó là hình tròn hai đầu, không phải góc lồng góc.

### Ngoại lệ và nhầm lẫn

- **Cùng bán kính trong và ngoài là lỗi hay gặp nhất của mã này.**

  ```tsx
  {/* SAI */}  <div className="rounded-2xl p-2"><img className="w-full rounded-2xl" /></div>
  {/* ĐÚNG */} <div className="rounded-2xl p-2"><img className="w-full rounded-lg" /></div>
  ```

  Vành đo 8px ở cạnh thẳng và ≈ 11,3px ở góc chéo: góc **rỗng ra** 41%.

- **Vuông góc bên trong thì bóp ngược lại.**

  ```tsx
  {/* SAI */} <div className="rounded-2xl p-2"><img className="w-full rounded-none" /></div>
  ```

  Vành tụt còn ≈ 4,7px ở góc chéo.

- **Khoảng đệm trong ≥ bán kính ngoài ⇒ `OPTICAL-0`,** không phải một phép trừ ra số âm.
- **Bán kính không phải khối lượng.** Bo tròn thêm để "nhìn nhẹ hơn" là đổi ngôn ngữ hình dạng, không
  có mã nào ở đây nhận.
- **Đường viền không tính vào vành.** Vành là **khoảng đệm trong**; 1px đường viền nằm ngoài phép trừ và không đủ lớn
  để đo được ở bước nhỏ nhất.

---

## `OPTICAL-6` — cạnh dùng chung

### Trường hợp: trích dẫn mở bằng dấu ngoặc kép

```tsx
<blockquote className="max-w-prose">
  <p className="-indent-[0.42em] text-lg leading-8">
    “Phần khó nhất không phải là viết ra hệ thống, mà là giữ cho nó giải thích được sau sáu tháng.”
  </p>
  <footer className="mt-3 text-sm text-neutral-500">Trưởng nhóm nền tảng</footer>
</blockquote>
```

**Phép đo.** Mực của dòng đầu bắt đầu tại `x = 0 + bề rộng dấu ngoặc`, các dòng sau bắt đầu tại `x = 0`.
Chênh lệch chính bằng bề rộng dấu, khoảng 0,42em ở cỡ này. `-indent-[0.42em]` treo dấu ra ngoài để mọi
dòng cùng bắt đầu ở một chỗ.

### Trường hợp: nút văn bản canh theo cột chữ

```tsx
<section className="flex flex-col gap-3">
  <p className="max-w-prose text-sm">Bạn đã hoàn thành 8 trong 12 bài của học phần này.</p>
  <button className="-ml-3 inline-flex w-fit items-center rounded-md px-3 py-2 text-sm font-medium" type="button">
    Xem bài tiếp theo
  </button>
</section>
```

**Phép đo.** `px-3` = 12px, nên chữ trong nút bắt đầu lệch phải 12px so với chữ của đoạn văn. `-ml-3`
trả đúng 12px đó. Con số âm **bằng đúng khoảng đệm trong của chính nó** — lớn hơn thế là đổi bố cục, không còn
là quang học.

### Trường hợp: cột tiền canh phải

```tsx
<table className="w-full text-sm">
  <tbody className="divide-y">
    <tr>
      <td className="py-2">Gói cơ bản</td>
      <td className="py-2 text-right tabular-nums">499.000</td>
    </tr>
    <tr>
      <td className="py-2">Gói nâng cao</td>
      <td className="py-2 text-right tabular-nums">1.111.000</td>
    </tr>
  </tbody>
</table>
```

**Phép đo.** Trong bộ số tỉ lệ, `111` hẹp hơn `000` chừng 15%; cột canh phải vẫn thẳng ở mép nhưng
**mọi chữ số bên trong nhảy chỗ** giữa hai hàng. `tabular-nums` cho mọi chữ số một bề rộng, và cột
thẳng theo từng hàng số chứ không chỉ ở mép.

### Trường hợp: đơn vị tiền tệ không được ăn vào cột số

```tsx
<span className="inline-flex items-baseline justify-end gap-1">
  <span className="tabular-nums">1.240.000</span>
  <span className="w-3 text-left text-neutral-500">đ</span>
</span>
```

### Trường hợp: danh sách đánh số quá chín mục

```tsx
<ol className="ml-6 flex list-outside list-decimal flex-col gap-2 marker:tabular-nums">
  <li>Xác định ràng buộc dữ liệu.</li>
  <li>Chọn mô hình nhất quán.</li>
  <li>Đo lại độ trễ đuôi.</li>
</ol>
```

`list-outside` đưa dấu ra khỏi cột chữ để dòng đầu và dòng gãy cùng một cạnh; `marker:tabular-nums`
giữ dấu `9.` và `10.` cùng bề rộng.

### Trường hợp: thời lượng dạng `mm:ss` trong danh sách

```tsx
<ul className="divide-y">
  <li className="flex items-center justify-between py-2 text-sm">
    <span className="truncate">Nhất quán và đồng thuận</span>
    <span className="ml-4 shrink-0 tabular-nums text-neutral-500">08:12</span>
  </li>
  <li className="flex items-center justify-between py-2 text-sm">
    <span className="truncate">Hàng đợi và tải đỉnh</span>
    <span className="ml-4 shrink-0 tabular-nums text-neutral-500">11:03</span>
  </li>
</ul>
```

### Trường hợp lồng mã: `OPTICAL-6` và `OPTICAL-4` trong `OPTICAL-5`

```tsx
<figure className="rounded-2xl border p-2">
  <blockquote className="rounded-lg bg-neutral-50 p-6">
    <p className="-indent-[0.42em] text-2xl leading-9 tracking-tight">
      “Đo trước, rồi hãy nhúc nhích.”
    </p>
  </blockquote>
</figure>
```

Ba mã, ba thuộc tính: 16 − 8 = 8 ⇒ `rounded-lg` là `OPTICAL-5`; `tracking-tight` ở cỡ 24px là
`OPTICAL-4`; dấu ngoặc treo ra ngoài cột chữ là `OPTICAL-6`.

### Ngoại lệ và nhầm lẫn

- **`text-right` không phải canh cột.** Nó canh **mép**, không canh chữ số.

  ```tsx
  {/* SAI */}  <td className="text-right">1.111.000</td>
  {/* ĐÚNG */} <td className="text-right tabular-nums">1.111.000</td>
  ```

- **Kéo âm lớn hơn khoảng đệm trong của chính thành phần điều khiển là đổi bố cục.**

  ```tsx
  {/* SAI */} <button className="-ml-6 rounded-md px-3 py-2">Xem thêm</button>
  ```

- **Một dấu trong một hộp không phải cạnh chung.** Biểu tượng chữ V lệch trong nút của nó là `OPTICAL-1`.
- **`list-inside` kéo dấu vào cột chữ,** và mọi dòng gãy sẽ bắt đầu lệch khỏi dòng đầu. Không dùng
  cho danh sách có nội dung dài.
- **Đừng treo dấu bằng `pl-*` âm trên vùng chứa.** Nó kéo cả khối, kể cả những dòng đang đúng.

---

## Ánh xạ yêu cầu sang một ghi đè

Nêu giá trị đã đo, dấu hiệu đo được và thuộc tính bị sửa. Nếu thiếu **phép đo**, câu trả lời là
`OPTICAL-0` cho tới khi có người đo — không phải một câu hỏi, và cũng không phải một cú nhúc nhích thử.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Nút phát nhìn lệch trái trong ô tròn | Trọng tâm tam giác lệch trái 1px so với tâm viewBox | `OPTICAL-1` | `translate-x-px` |
| Nút "Xem tất cả" nhìn thừa khoảng đệm trong bên phải | Mực biểu tượng chữ V dừng trước mép hộp ≈ 1,5px | `OPTICAL-1` | `pr-2.5` thay cho `pr-3` |
| Chấm tròn nhìn bé hơn ô vuông cùng cỡ | Tròn phủ 78,5% diện tích vuông | `OPTICAL-2` | `size-2.5` cạnh `size-2` |
| Biểu tượng nhìn hụt so với chữ bên cạnh | Mực biểu tượng 9,6px so với cap 10px | `OPTICAL-2` | `size-[1.125rem]` |
| Số trong nhãn trạng thái tròn nhìn dính đáy | Trống dưới đường chân chữ > trống trên cap ≈ 4% cỡ chữ | `OPTICAL-3` | `leading-none pb-px` |
| Biểu tượng nhìn trôi giữa đoạn văn nhiều dòng | `items-center` canh vào giữa khối, không vào dòng đầu | `OPTICAL-3` | `mt-[3px]` thay cho `items-center` |
| Tiêu đề 48px nhìn rời rạc | Tỉ lệ khoảng cách trên cap giữ nguyên khi cỡ tăng gấp ba | `OPTICAL-4` | `tracking-tight` |
| Nhãn chữ hoa 11px nhìn dính | Chữ hoa không có phần nhô để mắt bám | `OPTICAL-4` | `tracking-wide` |
| Ảnh trong thẻ nhìn rỗng ở bốn góc | Vành 8px ở cạnh, 11,3px ở góc chéo | `OPTICAL-5` | `rounded-lg` trong `rounded-2xl p-2` |
| Trích dẫn nhìn thụt ở dòng đầu | Mực dòng đầu bắt đầu sau bề rộng dấu ngoặc | `OPTICAL-6` | `-indent-[0.42em]` |
| Cột tiền nhìn nhảy giữa các hàng | `111` hẹp hơn `000` ≈ 15% | `OPTICAL-6` | `tabular-nums` |
| Nút văn bản nhìn thụt so với đoạn trên | Chữ trong nút lệch đúng bằng `px-3` | `OPTICAL-6` | `-ml-3` |
| Thẻ này "nhìn hơi chật, nới ra tí" | Không nêu được chênh lệch nào đo lại được | `OPTICAL-0` | không ghi đè |
| Bo tròn thêm cho thẻ nhìn nhẹ hơn | Bán kính không phải khối lượng | `OPTICAL-0` | không ghi đè |

Hai dòng cuối là kết quả **đúng**, không phải kết quả từ chối. Chúng trả yêu cầu về đúng luật sở hữu
con số ban đầu.

## Bảng phân định ranh giới

Chỉ hỏi khi phép đo thật sự chưa được chạy.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `OPTICAL-0` / mọi mã | Có ai đo ra được chênh lệch, hay chỉ có cảm giác? |
| `OPTICAL-1` / `OPTICAL-2` | Dấu sai **chỗ** hay sai **cỡ**? |
| `OPTICAL-1` / `OPTICAL-3` | Thứ lệch là hình dáng tự vẽ hay là hộp dòng do phông chữ phát ra? |
| `OPTICAL-1` / `OPTICAL-6` | Một dấu trong hộp của nó, hay một cạnh mà nhiều dòng cùng giữ? |
| `OPTICAL-2` / `OPTICAL-3` | Sai trục dọc, hay sai lượng mực? |
| `OPTICAL-3` / `OPTICAL-4` | Sai chiều dọc của chữ, hay sai chiều ngang? |
| `OPTICAL-4` / `OPTICAL-6` | Chuỗi này có đang giữ một cột không? Nếu có, `tracking` bị cấm. |
| `OPTICAL-5` / `OPTICAL-0` | Khoảng đệm trong có nhỏ hơn bán kính ngoài không? |

## Sai lầm lặp lại nhiều nhất

1. Nhúc nhích mà không nêu phép đo — mã duy nhất nhận được câu đó là `OPTICAL-0`.
2. Phóng to để chữa lệch, hoặc dịch để chữa nhỏ.
3. Chữa quang học bằng `margin` trên một phần tử cùng cấp, tức là bóp khoảng cách giữa các phần tử của luật khác.
4. Cho bán kính trong bằng bán kính ngoài.
5. `text-right` mà quên `tabular-nums`, rồi tưởng cột đã thẳng.
6. Nới `tracking` cho văn bản nội dung, hoặc cho một cột số.
7. `items-center` để canh biểu tượng vào một đoạn nhiều dòng.
8. Đo ghi đè chữ hoa trên chuỗi không dấu rồi để nội dung thật cắt mất dấu.
9. Quên lật ghi đè ngang cho RTL.
10. Ghi đè trên nội dung thật mà không ghi đè trên khung chờ, nên bố cục nhảy đúng lúc dữ liệu về.
