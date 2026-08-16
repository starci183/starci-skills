---
id: fe-principles-contrast-example
title: example.md
slug: /gates/principles/contrast/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp và ngoại lệ của từng mã CONTRAST-N, viết bằng className thuần.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `contrast` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **mã đánh dấu thường với `className` thường**. Không thư viện thành phần, không thiết kế
hệ thống riêng, không khoá đăng ký. Một luật chỉ đúng khi nó đúng ở bất kỳ giao diện nào — nên nếu một
ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó sai chỗ.

Mỗi mã có **nhiều trường hợp**, rồi tới **ngoại lệ** và **những thứ trông giống nhưng không phải mã đó**.
Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một cặp đã đo.

Một quy ước đọc xuyên suốt: **nền được khai báo ở đâu thì cặp bắt đầu ở đó.** Khi một ví dụ mở đầu
bằng `bg-…`, đó không phải trang trí — đó là nửa còn lại của phép đo, được viết ra để nhìn thấy được.

---

## `CONTRAST-0` — trang trí, không có cặp

### Trường hợp: hoa văn nền của biểu ngữ

```tsx
<section className="relative overflow-hidden rounded-lg bg-card p-6">
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-10">
    <svg className="size-full" />
  </div>
  <p className="relative text-foreground">Học kỳ mùa thu mở đăng ký đến hết ngày 30/09.</p>
</section>
```

Hoa văn không mang dữ kiện nào, nhưng nó vẫn nằm **dưới** chữ — nên `opacity-10` ở đây không phải
thẩm mỹ, nó giữ cho cặp `bg-card` / `text-foreground` không bị đổi bởi một lớp thứ ba.

### Trường hợp: biểu tượng lặp lại đúng chữ ngay cạnh nó

```tsx
<p className="flex items-center gap-2 text-foreground">
  <svg aria-hidden="true" className="size-4 text-muted-foreground" />
  Đã lưu lúc 14:20
</p>
```

### Trường hợp: dấu ngoặc kép cỡ lớn của một trích dẫn

```tsx
<figure className="relative bg-card p-6">
  <span aria-hidden="true" className="absolute left-4 top-2 text-6xl leading-none text-border">“</span>
  <blockquote className="relative text-foreground">Bài lab về retry buộc mình tìm ra idempotency trước.</blockquote>
</figure>
```

Dấu ngoặc kép cỡ lớn **trông** như `CONTRAST-2` vì nó to và là ký tự, nhưng nó không được đọc; nghĩa
của nó đã nằm trong thẻ `blockquote`.

### Trường hợp: đường phân cách chỉ nhắc lại một ranh giới đã nói bằng khoảng cách

```tsx
<div className="flex flex-col gap-6">
  <section className="flex flex-col gap-3">
    <h2 className="text-foreground">Tổng quan</h2>
    <p className="text-muted-foreground">…</p>
  </section>
  <hr aria-hidden="true" className="border-border" />
  <section className="flex flex-col gap-3">
    <h2 className="text-foreground">Hoạt động</h2>
    <p className="text-muted-foreground">…</p>
  </section>
</div>
```

Hai tiêu đề và khoảng cách đã nói xong ranh giới; đường kẻ chỉ nhắc lại. Cùng đường kẻ đó, nếu nó là
mép duy nhất của một ô nhập, sẽ là `CONTRAST-3`.

### Ngoại lệ và nhầm lẫn

- **Ảnh nền là `CONTRAST-0`; chữ trên ảnh thì không.** Chữ đó là `CONTRAST-6`.

  ```tsx
  {/* SAI — coi cả cụm là trang trí rồi bỏ qua phép đo */}
  <div aria-hidden="true" className="bg-[url('/cover.jpg')] p-6">
    <h2 className="text-white">Khoá học mới</h2>
  </div>
  ```

- **Khung chờ là `CONTRAST-0` với hình khối, nhưng vẫn phải báo trạng thái bằng chữ:**

  ```tsx
  <div aria-busy="true" className="flex flex-col gap-2 bg-card p-4">
    <span aria-hidden="true" className="h-5 w-40 rounded bg-muted" />
    <span aria-hidden="true" className="h-4 w-24 rounded bg-muted" />
    <span className="sr-only">Đang tải danh sách khoá học</span>
  </div>
  ```

- **Dấu chữ thương hiệu đem đi làm tiêu đề thì mất miễn trừ.** Miễn trừ biểu trưng chữ gắn với **dấu hiệu thương hiệu**,
  không gắn với hình dạng chữ. Đặt cùng chữ đó làm tiêu đề trang là `CONTRAST-2`.
- **"Không ai đọc cái đó đâu" không phải phép thử.** Phép thử là gỡ nó ra và hỏi có dữ kiện nào không
  còn cách nào khác để biết không.

---

## `CONTRAST-1` — chữ thường, 4.5:1

### Trường hợp: cặp được khai báo ngay tại chỗ dùng

```tsx
<article className="rounded-lg bg-card p-4">
  <h3 className="font-medium text-foreground">Đọc và ghi theo cơ chế quorum</h3>
  <p className="text-sm text-muted-foreground">Cập nhật lần cuối 16/08/2026</p>
</article>
```

Nền `bg-card` được khai báo ở đúng nút DOM bọc hai dòng chữ, nên cặp nhìn thấy được mà không phải leo cây.
Đây là lý do luật đòi nền **đã khai báo**: một cặp đọc được trong một màn hình mã là một cặp có người
kiểm được.

### Trường hợp: chữ mờ trên khung mờ — cặp hay bị bỏ sót nhất

```tsx
{/* SAI — hai quyết định đúng riêng lẻ, ghép lại thành cặp không ai đo */}
<div className="rounded-md bg-muted p-3">
  <span className="text-xs text-muted-foreground">Còn 3 ngày</span>
</div>
```

```tsx
{/* ĐÚNG — nền lồng thì chữ trả về mức đọc chính */}
<div className="rounded-md bg-muted p-3">
  <span className="text-xs text-foreground">Còn 3 ngày</span>
</div>
```

Sai lầm ở đây không nằm trong bất kỳ dòng nào của bản sai. Luật màu chọn `text-muted-foreground` vì
đây là chữ phụ, và chọn `bg-muted` vì đây là vùng lồng — **cả hai đều đúng theo luật của chúng**. Chỉ
có cặp là sai, và cặp là thứ luật màu không nhìn.

### Trường hợp: văn bản gợi ý và văn bản hỗ trợ

```tsx
<div className="flex flex-col gap-3 bg-background">
  <label className="text-sm font-medium text-foreground" htmlFor="slug">Đường dẫn</label>
  <input
    className="rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground"
    id="slug"
    placeholder="vi-du-duong-dan"
  />
  <p className="text-xs text-muted-foreground">Chỉ dùng chữ thường và dấu gạch ngang.</p>
</div>
```

Văn bản gợi ý là chữ người dùng phải đọc để biết định dạng, nên nó không được hưởng bất kỳ nhân nhượng
nào so với chữ thường.

### Trường hợp: thông báo lỗi kiểm tra tính hợp lệ

```tsx
<div className="flex flex-col gap-1">
  <input aria-invalid="true" className="rounded-md border border-danger bg-background px-3 py-2 text-foreground" id="email" />
  <p className="text-xs text-danger" id="email-error">Email này đã được dùng cho một tài khoản khác.</p>
</div>
```

### Trường hợp: chữ trong một nhãn trạng thái có nền riêng

```tsx
<span className="rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">Đã hoàn thành</span>
```

Nhãn trạng thái tự khai báo nền, nên cặp là `bg-success/15` với `text-success` — **không phải** `text-success`
với nền trang. Độ trong suốt `/15` nằm trong cặp và phải được đo cùng nó.

### Trường hợp: chữ phụ trong hàng của danh sách

```tsx
<li className="flex items-center justify-between bg-card p-4">
  <span className="flex flex-col gap-1">
    <span className="font-medium text-foreground">Gói chuyên sâu</span>
    <span className="text-sm text-muted-foreground">Thanh toán 16/08/2026</span>
  </span>
  <span className="tabular-nums text-foreground">499.000đ</span>
</li>
```

### Ngoại lệ và nhầm lẫn

- **Không leo cây để đoán nền.** Nếu không nút DOM nào trong chuỗi cha khai báo nền, cặp chưa tồn tại:

  ```tsx
  {/* SAI — nền đến từ đâu không ai biết */}
  <div className="p-4">
    <p className="text-muted-foreground">Bạn còn 2 bài chưa nộp.</p>
  </div>
  ```

- **Độ trong suốt trên chữ là một cặp mới:**

  ```tsx
  {/* SAI — pha loãng một token đã đo không giữ lại kết quả đo */}
  <p className="text-foreground/60">Hạn nộp 20/08</p>
  ```

- **Đạt sáng chưa phải đạt.** Cùng một cặp phải qua ở cả hai chủ đề; nếu chỉ một chủ đề qua thì cặp
  chưa qua, và câu trả lời không phải là đổi màu ở một chủ đề cho tới khi nó trông ổn.
- **Chữ trong thành phần điều khiển vô hiệu là `CONTRAST-7`,** nhưng dòng giải thích vì sao nó vô hiệu vẫn là
  `CONTRAST-1`.
- **Chữ trên ảnh không phải mã này** cho tới khi qua `CONTRAST-6`.

---

## `CONTRAST-2` — chữ lớn, 3:1

### Trường hợp: tiêu đề trang

```tsx
<header className="bg-background p-6">
  <h1 className="text-3xl font-semibold text-foreground">Lộ trình hệ thống phân tán</h1>
</header>
```

### Trường hợp: số liệu lớn trong thẻ thống kê — hai mã trong một thẻ

```tsx
<div className="flex flex-col gap-1 rounded-lg bg-card p-4">
  <span className="text-4xl font-semibold tabular-nums text-muted-foreground">86</span>
  <span className="text-sm text-foreground">bài đã hoàn thành</span>
</div>
```

Con số ở `text-4xl` đủ ngưỡng nên chịu 3:1; dòng nhãn ngay dưới nó không đủ ngưỡng nên chịu 4.5:1.
**Cùng một thẻ, hai mã** — và đó là lý do nhãn ở đây không được để `text-muted-foreground` chỉ vì con
số phía trên đã được phép để.

### Trường hợp: chữ đổi cỡ theo điểm ngắt

```tsx
{/* SAI — đạt ngưỡng ở desktop, tụt xuống dưới ngưỡng ở mobile */}
<h2 className="bg-background text-lg font-normal text-muted-foreground md:text-3xl">Bài kiểm tra giữa khoá</h2>
```

```tsx
{/* ĐÚNG — cặp phải đạt ở breakpoint nhỏ nhất mà nó render */}
<h2 className="bg-background text-lg font-normal text-foreground md:text-3xl">Bài kiểm tra giữa khoá</h2>
```

Một cặp "đúng ở máy tính" là một cặp chưa đo, chứ không phải một mã linh hoạt theo màn hình.

### Ngoại lệ và nhầm lẫn

- **Phóng to chữ để khỏi phải đo là lách luật.** Cỡ chữ là quyết định của kiểu chữ; độ tương phản chỉ
  nhận hệ quả của nó. Đổi `text-base` thành `text-2xl` cho một dòng phụ là nói dối về thứ bậc đọc để
  đổi lấy một tỉ lệ dễ hơn.
- **In đậm không tự nâng ngưỡng.** Ngưỡng in đậm là 18.66px; `font-bold` trên `text-sm` vẫn là
  `CONTRAST-1`.
- **Chữ lớn trong ảnh vẫn là `CONTRAST-6`.**
- **Số lớn là chữ; cột biểu đồ là đồ hoạ.** To hơn không biến `CONTRAST-3` thành `CONTRAST-2`.

---

## `CONTRAST-3` — thành phần điều khiển, đồ hoạ, biên chịu lực

### Trường hợp: viền là mép duy nhất của ô nhập

```tsx
<input
  aria-label="Mã giảm giá"
  className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
/>
```

Không có viền thì không có gì nói cho người dùng biết vùng bấm bắt đầu từ đâu — đó là định nghĩa của
"chịu lực", và là chỗ tách `CONTRAST-3` khỏi `CONTRAST-0`.

### Trường hợp: nút có nền — hai cặp trên một nút

```tsx
<button className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground" type="submit">
  Ghi danh
</button>
```

Cặp thứ nhất: `bg-primary` với `text-primary-foreground`, là `CONTRAST-1` vì đó là chữ. Cặp thứ hai:
`bg-primary` với nền trang phía sau, là `CONTRAST-3` vì đó là **hình** của thành phần điều khiển. Một nút không bao
giờ chỉ có một phép đo.

### Trường hợp: nút chỉ có biểu tượng

```tsx
<button aria-label="Đóng" className="rounded-md p-2 text-foreground hover:bg-muted" type="button">
  <svg aria-hidden="true" className="size-4" />
</button>
```

Biểu tượng ở đây là kênh **duy nhất** chỉ ra chức năng trên màn hình, nên nó chịu 3:1; `aria-label` trả nợ
cho `CONTRAST-5` chứ không trả nợ tỉ lệ.

### Trường hợp: hộp kiểm chưa vạch chia

```tsx
<label className="flex items-center gap-2 bg-background text-sm text-foreground">
  <input className="size-4 rounded border border-border accent-primary" type="checkbox" />
  Nhận thông báo qua email
</label>
```

Ô chưa vạch chia là một ô trống; nếu mép của nó không nhìn ra thì trạng thái "chưa chọn" không tồn tại trên
màn hình.

### Trường hợp: thanh tiến độ

```tsx
<div className="bg-card p-4">
  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
    <div className="h-full w-2/3 rounded-full bg-primary" role="presentation" />
  </div>
  <p className="mt-2 text-sm text-foreground">Đã hoàn thành 68% lộ trình</p>
</div>
```

Cặp phải đo ở đây là **ruột với máng** (`bg-primary` với `bg-muted`), không phải ruột với nền trang —
ranh giới người ta đọc là chỗ hai thứ đó gặp nhau.

### Trường hợp: gạch dưới của thẻ tab đang chọn

```tsx
<div className="flex items-center gap-2 border-b border-border bg-background" role="tablist">
  <button className="border-b-2 border-primary px-3 py-2 text-sm text-foreground" role="tab" type="button">Tổng quan</button>
  <button className="border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground" role="tab" type="button">Hoạt động</button>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Biểu tượng lặp lại chữ bên cạnh là `CONTRAST-0`, không phải mã này.**
- **Viền của thẻ thường là `CONTRAST-0` khi thẻ đã có nền riêng:**

  ```tsx
  <div className="rounded-lg border border-border bg-card p-4">…</div>
  ```

  Mép đã được nói bằng chỗ đổi nền; đường viền chỉ làm nó gọn hơn. Nhưng nếu thẻ **không** có nền
  riêng thì đường viền quay lại là bằng chứng duy nhất về mép, và nó là `CONTRAST-3`.

- **Đừng làm mảnh đi để né:** giảm từ `border` xuống hairline không đổi được nghĩa vụ; tỉ lệ tính theo
  màu, không theo bề dày.
- **Trạng thái rê chuột không thay được trạng thái mặc định:**

  ```tsx
  {/* SAI — control chỉ nhìn ra được khi đã trỏ chuột vào */}
  <button className="px-3 py-2 text-sm hover:border hover:border-border" type="button">Lọc</button>
  ```

- **Chữ đặt trên nút là `CONTRAST-1`.** Nhầm chữ sang mã này là hạ 4.5:1 xuống 3:1 cho một dòng chữ
  nhỏ — đây là cách phổ biến nhất để một nút "đạt chuẩn" mà vẫn không đọc được.

---

## `CONTRAST-4` — vòng tiêu điểm

### Trường hợp: vòng tiêu điểm có khoảng tách

```tsx
<button
  className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
  type="button"
>
  Nộp bài
</button>
```

`ring-offset-2` cắt một vành **nền** vào giữa nút và vòng, nên vòng phải tương phản với nền chứ không
phải với nút. Đó là lý do `ring-offset-background` không phải trang trí: nó khai báo nửa còn lại của
phép đo thứ hai.

### Trường hợp: tiêu điểm trên nền lồng — khoảng tách phải khai lại

```tsx
<div className="rounded-lg bg-muted p-4">
  <button
    className="rounded-md border border-border px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted"
    type="button"
  >
    Xem chi tiết
  </button>
</div>
```

Nút đứng trên `bg-muted`, nên vành khoảng tách là màu của `bg-muted`. Để nguyên `ring-offset-background` ở
đây là vẽ một vành sai màu quanh nút, và vành đó chính là thứ vòng tiêu điểm phải tương phản với.

### Trường hợp: tiêu điểm và được chọn là hai sự thật khác nhau

```tsx
<button
  aria-selected="true"
  className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  role="option"
  type="button"
>
  <svg aria-hidden="true" className="size-4" />
  Lộ trình backend
</button>
```

Nền nhạt nói "đang chọn"; vòng nói "bàn phím đang ở đây". Dùng chung một dấu hiệu cho cả hai làm người
dùng bàn phím mất chỗ đứng ngay khi họ đi qua một mục đã chọn.

### Trường hợp: thẻ bấm được

```tsx
<a
  className="block rounded-lg border border-border bg-card p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
  href="#course"
>
  <h3 className="font-medium text-foreground">Thiết kế hệ thống</h3>
  <p className="text-sm text-muted-foreground">12 bài · 6 giờ</p>
</a>
```

### Ngoại lệ và nhầm lẫn

- **`outline-none` mà không thay bằng gì là xoá mã, không phải thu nhỏ mã:**

  ```tsx
  {/* SAI */}
  <button className="rounded-md bg-primary px-3 py-2 focus:outline-none" type="button">Lưu</button>
  ```

- **Đổi màu nền khi tiêu điểm không phải chỉ báo:**

  ```tsx
  {/* SAI — hai nền cạnh nhau chênh nhau quá ít để làm dấu định vị */}
  <button className="rounded-md bg-card px-3 py-2 focus-visible:bg-muted" type="button">Lưu</button>
  ```

- **Đạt một phía là chưa đạt.** Vòng sáng trên nút tối nhưng chìm vào nền sáng bên ngoài thì mất dấu
  đúng ở lúc nó cần được thấy nhất.
- **Chỉ áp cho `focus`, không cho `focus-visible`,** sẽ dựng một vòng nhảy ra khi bấm chuột; đó là một
  quyết định khác và không thuộc mã này.

---

## `CONTRAST-5` — màu không phải kênh duy nhất

### Trường hợp: trạng thái đơn hàng có chữ, không chỉ có màu

```tsx
{/* SAI — bỏ màu đi là mất sạch nghĩa */}
<span className="size-2 rounded-full bg-success" />
```

```tsx
{/* ĐÚNG */}
<span className="inline-flex items-center gap-2 text-sm text-foreground">
  <span aria-hidden="true" className="size-2 rounded-full bg-success" />
  Đã thanh toán
</span>
```

### Trường hợp: liên kết trong đoạn văn

```tsx
<p className="text-foreground">
  Xem thêm ở
  <a className="text-primary underline underline-offset-2" href="#policy">chính sách hoàn phí</a>
  trước khi huỷ ghi danh.
</p>
```

Trong một khối chữ, sắc màu là thứ duy nhất tách liên kết khỏi chữ thường; gạch dưới là kênh thứ hai rẻ nhất
và là kênh duy nhất không mất đi khi in đen trắng.

### Trường hợp: trường nhập liệu lỗi — viền, biểu tượng và chữ

```tsx
<div className="flex flex-col gap-1">
  <label className="text-sm font-medium text-foreground" htmlFor="phone">Số điện thoại</label>
  <input aria-describedby="phone-error" aria-invalid="true" className="rounded-md border border-danger bg-background px-3 py-2 text-foreground" id="phone" />
  <p className="flex items-center gap-1 text-xs text-danger" id="phone-error">
    <svg aria-hidden="true" className="size-3.5" />
    Số điện thoại phải có 10 chữ số.
  </p>
</div>
```

### Trường hợp: hai chuỗi dữ liệu trong biểu đồ

```tsx
<ul className="flex items-center gap-4 bg-card p-4 text-sm text-foreground">
  <li className="flex items-center gap-2">
    <span aria-hidden="true" className="size-3 rounded-sm bg-primary" />
    Bài đã học
  </li>
  <li className="flex items-center gap-2">
    <span aria-hidden="true" className="size-3 rounded-sm border-2 border-dashed border-primary" />
    Mục tiêu
  </li>
</ul>
```

Hai chuỗi có thể **đều** đạt 3:1 với nền mà vẫn không phân biệt được với nhau khi mù màu. Nét đứt là
kênh thứ hai; nhãn chữ là kênh thứ ba.

### Trường hợp: bảng bản so sánh thay đổi

```tsx
<ul className="bg-card font-mono text-sm text-foreground">
  <li className="bg-success/10 px-3 py-1"><span aria-hidden="true">+ </span>retryWithBackoff(request)</li>
  <li className="bg-danger/10 px-3 py-1"><span aria-hidden="true">- </span>retry(request)</li>
</ul>
```

### Ngoại lệ và nhầm lẫn

- **Đậm hơn không phải một kênh:**

  ```tsx
  {/* SAI — vẫn chỉ có hue, chỉ là hue khác */}
  <span className="text-danger-700">Quá hạn</span>
  ```

- **Chỉ thị trong câu hướng dẫn cũng bị luật này ràng buộc:**

  ```tsx
  {/* SAI */}
  <p className="text-foreground">Chọn các ô màu xanh để tiếp tục.</p>
  {/* ĐÚNG */}
  <p className="text-foreground">Chọn các ô có dấu tick để tiếp tục.</p>
  ```

- **`sr-only` trả nợ cho người dùng trình đọc màn hình, không trả nợ cho người mù màu.** Người nhìn
  bằng mắt mà không phân biệt được sắc màu vẫn không nhận được kênh thứ hai nào:

  ```tsx
  {/* CHƯA ĐỦ */}
  <span className="size-2 rounded-full bg-danger"><span className="sr-only">Thất bại</span></span>
  ```

- **Đủ tỉ lệ không xoá được mã này, và có biểu tượng không xoá được nghĩa vụ đo tỉ lệ.** Hai nghĩa vụ độc
  lập, cùng áp cùng lúc.

---

## `CONTRAST-6` — nền không xác định

### Trường hợp: chữ trên ảnh bìa, có lớp nền dựng thêm

```tsx
<div className="relative overflow-hidden rounded-lg">
  <img alt="" className="h-48 w-full object-cover" src={course.coverUrl} />
  <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/20" />
  <div className="absolute inset-x-0 bottom-0 p-4">
    <h3 className="text-2xl font-semibold text-white">Kiến trúc sự kiện</h3>
    <p className="text-sm text-white">12 bài · trình độ nâng cao</p>
  </div>
</div>
```

Cặp được đo ở đây là chữ với **lớp dải chuyển màu**, không phải chữ với bức ảnh. Bức ảnh đến từ dữ liệu và có
thể là bất cứ màu gì; lớp dải chuyển màu là thứ duy nhất mình kiểm soát được, nên nó là nửa còn lại hợp lệ
duy nhất của phép đo.

### Trường hợp: nhãn trạng thái đặt trên ảnh sản phẩm

```tsx
<div className="relative">
  <img alt="" className="aspect-square w-full rounded-lg object-cover" src={item.imageUrl} />
  <span className="absolute left-2 top-2 rounded-full bg-background px-2 py-0.5 text-xs text-foreground">
    Còn 3 suất
  </span>
</div>
```

Ở đây nền dựng thêm không phải phần tử chồng lớp mà là **nền đục của chính nhãn trạng thái**. Cách này mạnh hơn phần tử chồng lớp vì
nó không phụ thuộc vào chỗ nhãn trạng thái rơi trúng trên ảnh.

### Trường hợp: nội dung do người dùng tải lên làm nền hồ sơ

```tsx
<section className="relative">
  <img alt="" className="h-32 w-full object-cover" src={profile.bannerUrl} />
  <div aria-hidden="true" className="absolute inset-0 bg-black/50" />
  <div className="absolute inset-0 flex items-end p-4">
    <strong className="text-lg text-white">Nguyễn Văn An</strong>
  </div>
</section>
```

### Ngoại lệ và nhầm lẫn

- **Đo với ảnh trong bản thiết kế là đo với một dữ liệu may mắn:**

  ```tsx
  {/* SAI — không có lớp nào xác định; đọc được hay không là do ảnh */}
  <div className="relative">
    <img alt="" className="h-48 w-full object-cover" src={course.coverUrl} />
    <h3 className="absolute bottom-4 left-4 text-2xl text-white">Kiến trúc sự kiện</h3>
  </div>
  ```

- **`text-shadow` không phải một cặp.** Bóng chữ làm dịu mắt nhưng không tạo ra một nền đo được; nó
  không thay được `CONTRAST-6`.
- **Phần tử chồng lớp quá nhạt là phần tử chồng lớp trang trí.** Nếu vẫn phải cầu may vào ảnh sáng thì lớp đó chưa làm nền
  xác định được, và mã vẫn chưa được giải quyết.
- **Sau khi dựng nền, mã thật là `CONTRAST-1` hoặc `CONTRAST-2`.** `CONTRAST-6` là bước **đứng trước**,
  không phải mã thay thế.

---

## `CONTRAST-7` — thành phần điều khiển thật sự vô hiệu

### Trường hợp: nút gửi khi biểu mẫu chưa hợp lệ

```tsx
<div className="flex flex-col gap-2">
  <button
    className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
    disabled
    type="submit"
  >
    Ghi danh
  </button>
  <p className="text-xs text-foreground">Chọn ít nhất một lộ trình trước khi ghi danh.</p>
</div>
```

Nút được treo tỉ lệ; **dòng giải thích thì không**. Đó là lý do dòng đó dùng `text-foreground` chứ
không dùng màu mờ: nếu cả nút lẫn lý do đều mờ, người dùng nhận được một ngõ cụt không có lối ra.

### Trường hợp: bài học bị khoá trong danh sách

```tsx
<li className="flex items-center justify-between bg-card p-4">
  <span className="flex items-center gap-2">
    <svg aria-hidden="true" className="size-4 text-foreground" />
    <span className="text-foreground">Nhất quán và đồng thuận</span>
  </span>
  <button aria-disabled="true" className="rounded-md border border-border px-3 py-1 text-sm opacity-50" type="button">
    Đã khoá
  </button>
</li>
```

Tên bài học **không** bị treo tỉ lệ — người dùng phải đọc được thứ họ đang chờ mở khoá. Chỉ có thành phần điều khiển
mới được treo.

### Trường hợp: đang gửi không phải là vô hiệu

```tsx
<button
  aria-busy="true"
  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
  type="submit"
>
  <svg aria-hidden="true" className="size-4 animate-spin" />
  Đang gửi…
</button>
```

Nút bận vẫn phải đọc được, vì nội dung của nó đang báo cáo một việc đang chạy. Làm mờ nó là biến một
trạng thái tạm thời thành một trạng thái chết.

### Ngoại lệ và nhầm lẫn

- **Làm mờ mà không vô hiệu là giả vờ:**

  ```tsx
  {/* SAI — vẫn bấm được, vẫn tab tới được, mà lại được giảm nghĩa vụ */}
  <button className="rounded-md bg-primary px-3 py-2 text-sm opacity-50" type="submit">Ghi danh</button>
  ```

- **Đừng "sửa" độ tương phản của thành phần điều khiển vô hiệu:**

  ```tsx
  {/* SAI — đạt 4.5:1 nhưng mất tín hiệu không-bấm-được */}
  <button className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground" disabled>Ghi danh</button>
  ```

- **`readonly` không phải `disabled`.** Trường nhập liệu chỉ đọc vẫn nhận tiêu điểm và nội dung của nó vẫn phải đọc
  được ⇒ `CONTRAST-1`.
- **Miễn trừ mất hiệu lực ngay khi thành phần điều khiển sống lại.** Không có mã nào "dính" vào một nút DOM; mã dính
  vào một cặp trong một trạng thái.

---

## Mã lồng mã

### Ba mã trên một thẻ duy nhất

```tsx
<article className="rounded-lg border border-border bg-card p-4">
  <div className="flex items-start justify-between gap-4">
    <div className="flex flex-col gap-1">
      <h3 className="text-xl font-semibold text-foreground">Thiết kế hệ thống thực chiến</h3>
      <p className="text-sm text-foreground">Cập nhật 16/08/2026 · 12 bài</p>
    </div>
    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">
      <svg aria-hidden="true" className="size-3" />
      Đang mở
    </span>
  </div>
  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
    <div className="h-full w-1/2 rounded-full bg-primary" role="presentation" />
  </div>
</article>
```

Thẻ này chứa bốn cặp và bốn phép đo khác nhau: chữ với `bg-card` (`CONTRAST-1`); `bg-card` với nền
trang, do viền chỉ làm gọn mép chứ không phải mép duy nhất (`CONTRAST-0` cho viền, `CONTRAST-3` cho
chỗ đổi nền); chữ nhãn trạng thái với `bg-success/15` (`CONTRAST-1`) cộng biểu tượng làm kênh thứ hai (`CONTRAST-5`);
và ruột thanh tiến độ với máng của nó (`CONTRAST-3`). **Không cặp nào trong bốn cặp này đo được từ một
nút DOM đơn lẻ.**

### Nền lồng ba lớp — mỗi lớp là một cặp mới

```tsx
<main className="bg-background p-6">
  <section className="rounded-lg bg-card p-4">
    <div className="rounded-md bg-muted p-3">
      <p className="text-sm text-foreground">Bạn đang xem bản nháp chưa xuất bản.</p>
    </div>
  </section>
</main>
```

Ba lần đổi nền là ba cặp: `bg-card` với `bg-background`, `bg-muted` với `bg-card`, và chữ với
`bg-muted`. Cặp thứ ba là cặp duy nhất người ta hay nhớ đo, còn hai cặp kia quyết định người dùng có
nhìn ra được vùng lồng hay không.

### Tiêu điểm lồng trong `CONTRAST-6`

```tsx
<div className="relative overflow-hidden rounded-lg">
  <img alt="" className="h-40 w-full object-cover" src={lesson.thumbnailUrl} />
  <div aria-hidden="true" className="absolute inset-0 bg-black/55" />
  <button
    className="absolute inset-0 flex items-end p-4 text-left text-lg font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-inset"
    type="button"
  >
    Xem bài giảng
  </button>
</div>
```

Vòng tiêu điểm dùng `ring-inset` vì bên ngoài không có nền xác định để làm nửa còn lại của phép đo. Một
vòng có khoảng tách ở đây sẽ được đo với **bức ảnh**, tức là không được đo.

---

## Ánh xạ yêu cầu sang một cặp đã đo

Nêu tiền cảnh, nền **đã khai báo** và vai trò. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu
cụ thể rồi dừng. Câu trả lời phải là một cặp class CSS hoặc một câu hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Cho dòng ngày tháng nhạt hơn trong ô lồng | Vẫn là chữ phải đọc, nền lồng đã hạ sẵn tương phản | `CONTRAST-1` | `bg-muted text-foreground` |
| Đặt tiêu đề màn hình cỡ lớn | Vượt ngưỡng chữ lớn ở mọi điểm ngắt | `CONTRAST-2` | `bg-background text-3xl font-semibold text-foreground` |
| Vẽ ô nhập không có nền riêng | Viền là mép duy nhất của vùng bấm | `CONTRAST-3` | `border border-border bg-background text-foreground` |
| Bỏ vòng viền xanh mặc định của trình duyệt | Xoá chỉ báo, không phải thu nhỏ | `CONTRAST-4` | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` |
| Tô đỏ các dòng lỗi trong bảng | Sắc màu là kênh duy nhất mang nghĩa | `CONTRAST-5` | `bg-danger/10` + biểu tượng + chữ trạng thái |
| Đặt tên khoá học lên ảnh bìa | Nền chỉ biết lúc chạy | `CONTRAST-6` | phần tử chồng lớp `bg-gradient-to-t from-black/70` rồi `text-white` |
| Làm mờ nút cho tới khi biểu mẫu hợp lệ | Thành phần điều khiển thật sự không nhận thao tác | `CONTRAST-7` | `disabled` + `disabled:opacity-50` + lý do ở `text-foreground` |
| Thêm hoa văn chìm sau nội dung | Không mang dữ kiện nào | `CONTRAST-0` | `aria-hidden="true"`, không có cặp |
| Kẻ một đường giữa hai phần nội dung đã cách xa nhau | Ranh giới đã được nói bằng khoảng cách và tiêu đề | `CONTRAST-0` | `border-border`, không mang nghĩa vụ |
| Thêm biểu tượng cạnh chữ "Đã lưu" | Biểu tượng lặp lại đúng chữ ⇒ chưa chứng minh nó mang kênh nào | `CONTRAST-0` | `aria-hidden="true"` |

Ở hai dòng cuối, câu hỏi phân định **chỉ** được hỏi khi bên yêu cầu nói rõ đường kẻ hoặc biểu tượng là bằng
chứng duy nhất của một dữ kiện: *"Nếu gỡ thứ này ra, còn dữ kiện nào người dùng không còn cách nào
khác để biết không?"*

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `CONTRAST-0` / `CONTRAST-3` | Gỡ nó ra thì có dữ kiện nào biến mất, hay chỉ mất phần nhìn? |
| `CONTRAST-0` / `CONTRAST-7` | Miễn vì **là cái gì**, hay miễn vì **đang ở trạng thái nào**? |
| `CONTRAST-1` / `CONTRAST-2` | Cỡ chữ tính ra px ở điểm ngắt nhỏ nhất là bao nhiêu? |
| `CONTRAST-1` / `CONTRAST-3` | Đang đo chữ trên thành phần điều khiển, hay đo hình của thành phần điều khiển với nền? |
| `CONTRAST-1` / `CONTRAST-6` | Nền dưới chữ là một màu đã khai báo, hay là dữ liệu lúc chạy? |
| `CONTRAST-3` / `CONTRAST-4` | Dấu hiệu này mô tả thành phần điều khiển, hay mô tả vị trí bàn phím ngay lúc này? |
| `CONTRAST-3` / `CONTRAST-5` | Nhìn ra được so với nền là đủ, hay còn phải phân biệt với **nhau**? |
| `CONTRAST-7` / mọi mã khác | Thành phần điều khiển có thật sự không nhận thao tác, hay chỉ đang được làm mờ? |

## Sai lầm lặp lại nhiều nhất

1. Đo chữ với nền trang **mà mình đoán**, trong khi nó đang nằm trên một khung lồng.
2. Ghép chữ mờ lên nền mờ vì hai biến thiết kế đó, xét riêng, đều đúng luật màu.
3. Coi văn bản gợi ý, văn bản hỗ trợ và chú thích là "chữ phụ" nên được nhân nhượng.
4. Phóng to chữ để rơi xuống 3:1 thay vì đo cặp ở cỡ thật.
5. Chỉ kiểm ở chủ đề sáng rồi coi chủ đề tối là chuyện của biến thiết kế.
6. Pha độ trong suốt lên một biến thiết kế đã đo và tưởng kết quả đo còn hiệu lực.
7. `outline-none` mà không dựng lại vòng tiêu điểm.
8. Vòng tiêu điểm chỉ tương phản với thành phần điều khiển, chìm hẳn vào nền bên ngoài.
9. Dùng chung một dấu hiệu cho "đang chọn" và "đang tiêu điểm".
10. Đặt chữ lên ảnh rồi đo với bức ảnh trong bản thiết kế.
11. Làm mờ một thành phần điều khiển vẫn bấm được, rồi mượn miễn trừ của `CONTRAST-7`.
12. Làm mờ luôn cả dòng giải thích vì sao thành phần điều khiển bị khoá.
13. Chỉ dùng sắc màu để phân biệt hai chuỗi dữ liệu, rồi cho rằng đủ 3:1 với nền là xong.
14. Cho rằng `sr-only` đã trả nợ cho người mù màu.
