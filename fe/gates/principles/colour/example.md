---
id: fe-principles-colour-example
title: example.md
slug: /gates/principles/colour/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp và ngoại lệ của từng mã COLOUR-N, viết bằng className thuần.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `colour` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **mã đánh dấu thường với `className` thường**. Không thư viện thành phần, không thiết kế
hệ thống riêng, không khoá đăng ký, không bản xem trước trực tiếp của một sản phẩm nào. Một luật chỉ đúng khi nó
đúng ở bất kỳ giao diện nào — nên nếu một ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó
sai chỗ.

Mỗi mã có **nhiều trường hợp**, rồi tới **ngoại lệ và nhầm lẫn**: những thứ trông giống mã đó nhưng không
phải, và những thứ bị cấm. Cuối trang có mục **mã lồng mã**, bảng ánh xạ từ yêu cầu bằng lời sang
class CSS, và bảng phân định ranh giới.

---

## `COLOUR-1` — nội dung chính

### Trường hợp: tiêu đề của một khối nội dung

```tsx
<h3 className="text-base font-semibold text-foreground">Kiến trúc bộ nhớ đệm ở quy mô lớn</h3>
```

### Trường hợp: một câu hướng dẫn bắt buộc phải đọc

```tsx
<p className="text-sm text-foreground">
  Nhập mã gồm 6 chữ số vừa được gửi tới email của bạn để hoàn tất đăng nhập.
</p>
```

Câu này là **điều kiện để hành động**, không phải chú thích. Làm mờ nó là giấu mất việc người dùng
phải làm.

### Trường hợp: số tiền phải trả

```tsx
<div className="flex items-baseline gap-2">
  <span className="text-2xl font-semibold tabular-nums text-foreground">1.290.000đ</span>
  <span className="text-sm text-muted-foreground">đã gồm thuế</span>
</div>
```

Con số là quyết định (`COLOUR-1`); "đã gồm thuế" chỉ giải thích cho con số (`COLOUR-2`).

### Trường hợp: nội dung mới chưa có vai trò nào — dùng mặc định an toàn

```tsx
<p className="text-foreground">{comment.body}</p>
```

### Ngoại lệ và nhầm lẫn

- **Nội dung tích cực không phải `COLOUR-4`.** Một mức giảm giá là con số, không phải trạng thái
  thành công.

  ```tsx
  {/* SAI */}  <span className="text-success">Giảm 30%</span>
  {/* ĐÚNG */} <span className="text-foreground">Giảm 30%</span>
  ```

- **Không tô chính để làm tiêu đề nổi hơn.** Cấp bậc đọc là việc của kiểu chữ.

  ```tsx
  {/* SAI */}  <h2 className="text-primary">Đánh giá của học viên</h2>
  {/* ĐÚNG */} <h2 className="text-xl font-semibold text-foreground">Đánh giá của học viên</h2>
  ```

- **Không viết màu thô, kể cả khi nó "ra đúng màu hiện tại".** Biến thiết kế đổi giá trị theo chủ đề; hằng số
  thì không.

  ```tsx
  {/* SAI */}  <p className="text-[#111827]">…</p>
  {/* SAI */}  <p style={{ color: "rgb(17 24 39)" }}>…</p>
  {/* ĐÚNG */} <p className="text-foreground">…</p>
  ```

---

## `COLOUR-2` — nội dung hỗ trợ

### Trường hợp: thời gian cập nhật dưới tiêu đề

```tsx
<article className="flex flex-col gap-1">
  <h3 className="text-base font-semibold text-foreground">Kiến trúc bộ nhớ đệm ở quy mô lớn</h3>
  <p className="text-sm text-muted-foreground">Cập nhật 2 giờ trước</p>
</article>
```

### Trường hợp: số liệu mô tả một khoá học

```tsx
<div className="flex flex-col gap-1">
  <p className="text-base font-medium text-foreground">Nền tảng thiết kế hệ thống</p>
  <p className="text-sm text-muted-foreground">12 chương · 36 bài · 8 giờ</p>
</div>
```

### Trường hợp: xuất xứ của một dòng dữ liệu

```tsx
<li className="flex items-baseline justify-between gap-4">
  <span className="text-foreground">bao-cao-quy-4.pdf</span>
  <span className="text-sm text-muted-foreground tabular-nums">2,4 MB · PDF</span>
</li>
```

### Ngoại lệ và nhầm lẫn

- **Điều kiện nghiệp vụ không được làm mờ.** Câu dưới đây quyết định người dùng có bấm hay không:

  ```tsx
  {/* SAI */}  <p className="text-sm text-muted-foreground">Không hoàn tiền sau 7 ngày.</p>
  {/* ĐÚNG */} <p className="text-sm text-foreground">Không hoàn tiền sau 7 ngày.</p>
  ```

- **Giảm nhấn không có nội dung chính để bám vào thì không phải giảm nhấn.** Một màn hình mà **mọi** dòng đều
  mờ là một màn hình không có nội dung chính.

  ```tsx
  {/* SAI */}
  <div className="flex flex-col gap-1">
    <p className="text-muted-foreground">Nguyễn Văn An</p>
    <p className="text-muted-foreground">@an.nguyen</p>
  </div>

  {/* ĐÚNG */}
  <div className="flex flex-col gap-1">
    <p className="text-foreground">Nguyễn Văn An</p>
    <p className="text-sm text-muted-foreground">@an.nguyen</p>
  </div>
  ```

- **Giảm nhấn **không** phải bị vô hiệu hoá.** Đừng thêm `opacity-50` cho chữ mô tả; nó sẽ bị đọc thành "phần
  này đang hỏng".

---

## `COLOUR-3` — tương tác và mục đang chọn

### Trường hợp: liên kết trong nội dung

```tsx
<a className="font-medium text-primary hover:underline" href="/tai-lieu">Đọc tài liệu</a>
```

### Trường hợp: mục điều hướng đang mở — trạng thái chọn có dấu hiệu ngoài màu

```tsx
<a
  aria-current="page"
  className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary"
  href="/khoa-hoc"
>
  <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
  Khoá học
</a>
```

`aria-current` là dấu hiệu thật; chấm tròn là dấu hiệu thị giác ngoài màu. Bỏ cả hai thì "đang ở đây" chỉ còn
tồn tại bằng sắc độ.

### Trường hợp: thẻ tab đang chọn — dấu hiệu là đường gạch chân, không phải màu

```tsx
<div className="flex items-center gap-4 border-b border-border" role="tablist">
  <button
    aria-selected="true"
    className="-mb-px border-b-2 border-primary px-1 pb-2 text-sm text-primary"
    role="tab"
    type="button"
  >
    Tổng quan
  </button>
  <button
    aria-selected="false"
    className="-mb-px border-b-2 border-transparent px-1 pb-2 text-sm text-muted-foreground"
    role="tab"
    type="button"
  >
    Hoạt động
  </button>
</div>
```

### Trường hợp: rê chuột là tạm thời, không được trông giống trạng thái chọn

```tsx
<button
  className="rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
  type="button"
>
  Cài đặt tài khoản
</button>
```

Rê chuột dùng `bg-muted` chứ không dùng `bg-primary/10`, vì rê chuột không ghi nhớ gì cả.

### Ngoại lệ và nhầm lẫn

- **Nút hành động chính không phải màu thành công.** Nó là hành động, chưa phải kết quả.

  ```tsx
  {/* SAI */}  <button className="bg-success text-white" type="submit">Xác nhận thanh toán</button>
  {/* ĐÚNG */} <button className="bg-primary text-primary-foreground" type="submit">Xác nhận thanh toán</button>
  ```

- **Chữ tĩnh không bao giờ là `COLOUR-3`.** Không có `href`, không có hàm xử lý, không có
  `aria-current` ⇒ không phải tương tác.

- **Trạng thái chọn chỉ bằng màu là trạng thái chọn không tồn tại.** So sánh:

  ```tsx
  {/* SAI — bỏ màu đi thì không còn biết hàng nào đang chọn */}
  <li className="text-primary">Chương 3</li>

  {/* ĐÚNG */}
  <li aria-selected="true" className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-primary">
    <span aria-hidden="true">✓</span>
    Chương 3
  </li>
  ```

---

## `COLOUR-4` — kết quả thành công

### Trường hợp: trạng thái của một hoá đơn

```tsx
<span className="inline-flex items-center gap-1 text-sm text-success">
  <span aria-hidden="true">✓</span>
  Đã thanh toán
</span>
```

Biểu tượng và chữ giữ nguyên nghĩa khi người đọc không phân biệt được màu.

### Trường hợp: nhãn trạng thái hoàn thành trong một danh sách bài học

```tsx
<li className="flex items-center justify-between gap-4 p-4">
  <span className="text-foreground">Đọc và ghi theo cơ chế quorum</span>
  <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">
    <span aria-hidden="true">✓</span>
    Đã hoàn thành
  </span>
</li>
```

### Trường hợp: kết quả kiểm tra, kèm giá trị đọc được

```tsx
<p className="inline-flex items-center gap-2 text-sm text-success">
  <span aria-hidden="true">✓</span>
  <span>Đạt — 18/20 câu đúng</span>
</p>
```

### Ngoại lệ và nhầm lẫn

- **Thành công không có dấu hiệu là vi phạm điều kiện bất biến 4.**

  ```tsx
  {/* SAI */}  <span className="text-success">Đã thanh toán</span>
  ```

  Ở đây chữ "Đã thanh toán" **là** dấu hiệu — nhưng chỉ khi nó tự nói ra trạng thái. Một dòng
  `<span className="text-success">1.290.000đ</span>` thì không có dấu hiệu nào cả, và nó cũng không phải
  `COLOUR-4` ngay từ đầu.

- **Đừng suy ra thành công từ nội dung "nghe có vẻ tốt".** Giảm giá, điểm cao, lượt thích nhiều đều là
  `COLOUR-1`.

---

## `COLOUR-5` — cảnh báo còn cứu được

### Trường hợp: gói cước sắp hết hạn, kèm hành động phòng ngừa

```tsx
<div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3">
  <span aria-hidden="true" className="text-warning">!</span>
  <div className="flex flex-col gap-1">
    <p className="text-sm text-foreground">Gói cước hết hạn sau 3 ngày.</p>
    <a className="text-sm font-medium text-primary hover:underline" href="/thanh-toan">Gia hạn ngay</a>
  </div>
</div>
```

Chú ý: nền và viền mang mã `COLOUR-5`, còn **chữ vẫn là `COLOUR-1`** và liên kết vẫn là `COLOUR-3`. Một
phần tử một vai trò.

### Trường hợp: bản nháp chưa lưu

```tsx
<p className="inline-flex items-center gap-1 text-sm text-warning">
  <span aria-hidden="true">!</span>
  Bản nháp chưa được lưu
</p>
```

### Ngoại lệ và nhầm lẫn

- **Đã hỏng rồi thì không còn là cảnh báo.** Thì của động từ quyết định mã:

  ```tsx
  {/* COLOUR-5 */}  <span className="text-warning">Thẻ hết hạn sau 3 ngày</span>
  {/* COLOUR-6 */}  <span className="text-danger">Thẻ đã hết hạn</span>
  ```

- **Ghi chú trung tính không phải cảnh báo.** "Khoá học sẽ mở vào tháng sau" không có hậu quả nào nếu
  bỏ qua ⇒ `COLOUR-2`.

---

## `COLOUR-6` — thất bại và hành động phá huỷ

### Trường hợp: thao tác đã thất bại, có lý do đọc được

```tsx
<div className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 p-3">
  <span aria-hidden="true" className="text-danger">×</span>
  <div className="flex flex-col gap-1">
    <p className="text-sm text-foreground">Thanh toán thất bại.</p>
    <p className="text-sm text-muted-foreground">Ngân hàng từ chối giao dịch. Hãy thử thẻ khác.</p>
  </div>
</div>
```

### Trường hợp: trường nhập liệu không hợp lệ **sau khi** đã kiểm tra tính hợp lệ

```tsx
<label className="flex flex-col gap-1">
  <span className="text-sm text-foreground">Email</span>
  <input
    aria-describedby="email-error"
    aria-invalid="true"
    className="rounded-md border border-danger bg-background px-3 py-2 text-foreground"
    type="email"
  />
  <span className="text-sm text-danger" id="email-error">Email không đúng định dạng.</span>
</label>
```

Viền đỏ nói "có gì đó sai"; chỉ dòng thông điệp mới nói **sai cái gì**. `aria-describedby` nối hai
thứ lại để trình đọc màn hình cũng nhận được liên hệ đó.

### Trường hợp: hành động phá huỷ không hoàn tác được

```tsx
<button
  className="inline-flex items-center gap-2 rounded-md border border-danger px-3 py-2 text-sm text-danger"
  type="button"
>
  <span aria-hidden="true">🗑</span>
  Xoá vĩnh viễn workspace
</button>
```

Nút này vừa là hành động (`COLOUR-3`) vừa là phá huỷ (`COLOUR-6`). Vai trò phá huỷ thắng, vì hậu quả
của việc đọc nhầm lớn hơn.

### Ngoại lệ và nhầm lẫn

- **Trường nhập liệu bắt buộc mà chưa nhập thì chưa phải lỗi.** Tô đỏ ngay khi biểu mẫu vừa mở là nói dối:

  ```tsx
  {/* SAI — chưa validate mà đã báo lỗi */}
  <input aria-invalid="true" className="border-danger" defaultValue="" />

  {/* ĐÚNG — trung tính cho tới khi có kết quả validate */}
  <input className="rounded-md border border-border bg-background px-3 py-2" defaultValue="" required />
  ```

- **Chỉ đổi viền, không có thông điệp, là chưa đủ.** Người dùng sẽ biết mình sai mà không biết sửa gì.

- **Bị vô hiệu hoá không phải nguy hiểm.** Nút chưa bấm được thì dùng `COLOUR-8`, không tô đỏ.

---

## `COLOUR-7` — tiêu điểm bàn phím

### Trường hợp: ô nhập liệu

```tsx
<input
  className="rounded-md border border-border bg-background px-3 py-2 text-foreground focus-visible:ring-2 focus-visible:ring-ring"
  type="text"
/>
```

### Trường hợp: nút — tiêu điểm nhìn thấy trên mọi bề mặt

```tsx
<button
  className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  type="button"
>
  Lưu thay đổi
</button>
```

`ring-offset-2` để vòng tiêu điểm không chìm vào chính nền của nút.

### Trường hợp: trạng thái chọn và tiêu điểm cùng lúc trên một hàng

```tsx
<button
  aria-current="true"
  className="flex w-full items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-left text-primary focus-visible:ring-2 focus-visible:ring-ring"
  type="button"
>
  <span aria-hidden="true">✓</span>
  Mục hiện tại
</button>
```

Nền chính nói **đang chọn** và tồn tại lâu; vòng nói **bàn phím đang ở đây** và biến mất khi bấm
Thẻ tab. Hai thứ phải cùng nhìn thấy được, nếu không người dùng bàn phím sẽ lạc.

### Ngoại lệ và nhầm lẫn

- **Không bao giờ gỡ dàn ý mà không thay thế.**

  ```tsx
  {/* SAI */}  <button className="outline-none" type="button">Gửi</button>
  {/* ĐÚNG */} <button className="outline-none focus-visible:ring-2 focus-visible:ring-ring" type="button">Gửi</button>
  ```

- **Rê chuột không thay được tiêu điểm.** Chuột và bàn phím là hai đường vào khác nhau; chỉ có `hover:` thì
  người dùng bàn phím không thấy gì.

---

## `COLOUR-8` — bị vô hiệu hoá

### Trường hợp: nút gửi khi biểu mẫu chưa hợp lệ

```tsx
<button
  className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground opacity-50"
  disabled
  type="submit"
>
  Gửi bài
</button>
```

### Trường hợp: thành phần điều khiển bị khoá kèm lý do nói ra được

```tsx
<div className="flex flex-col gap-1">
  <button
    aria-describedby="export-reason"
    className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground opacity-50"
    disabled
    type="button"
  >
    Xuất báo cáo
  </button>
  <p className="text-xs text-muted-foreground" id="export-reason">
    Tính năng này thuộc gói nâng cao.
  </p>
</div>
```

Lý do là `COLOUR-2` — nó **không** bị `opacity-50`, vì bản thân dòng giải thích phải đọc được.

### Ngoại lệ và nhầm lẫn

- **`opacity-50` mà không có `disabled` là nói dối.** Người dùng sẽ bấm và không hiểu vì sao không có
  gì xảy ra.

  ```tsx
  {/* SAI */}  <button className="opacity-50" type="button">Tiếp tục</button>
  {/* ĐÚNG */} <button className="text-muted-foreground opacity-50" disabled type="button">Tiếp tục</button>
  ```

- **`disabled` mà không có `opacity-50` cũng sai.** Nhìn vẫn như bấm được.

- **Đừng dùng `COLOUR-8` cho chữ mô tả.** Giảm nhấn đã đủ; thêm `opacity-50` biến mô tả thành "hỏng".

---

## `COLOUR-9` — mặt phẳng gốc

### Trường hợp: thân trang

```tsx
<main className="min-h-screen bg-background p-6 text-foreground">
  …
</main>
```

### Ngoại lệ và nhầm lẫn

- **Nền trang không viết bằng `bg-card`.** Nếu mọi thứ đều là thẻ thì không còn gì nổi lên được.

  ```tsx
  {/* SAI */}  <main className="min-h-screen bg-card">…</main>
  {/* ĐÚNG */} <main className="min-h-screen bg-background text-foreground">…</main>
  ```

---

## `COLOUR-10` — bề mặt nổi

### Trường hợp: thẻ đứng trên nền trang

```tsx
<main className="bg-background p-6 text-foreground">
  <article className="rounded-xl border border-border bg-card p-4 text-foreground shadow-sm">
    <h3 className="text-base font-semibold text-foreground">Nền tảng thiết kế hệ thống</h3>
    <p className="text-sm text-muted-foreground">12 chương · 36 bài</p>
  </article>
</main>
```

Chủ đề đổi giá trị của `background` và `card`; **vai trò** của hai lớp không đổi. Đây là lý do dark
chế độ không cần một class CSS nào khác.

### Trường hợp: hộp thoại

```tsx
<div className="rounded-xl border border-border bg-card p-6 text-foreground shadow-lg" role="dialog">
  <h2 className="text-lg font-semibold text-foreground">Xoá workspace?</h2>
  <p className="mt-2 text-sm text-muted-foreground">Hành động này không thể hoàn tác.</p>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Thẻ lồng thẻ không tạo ra tầng nào.** Bên trong một `bg-card`, muốn nhóm tiếp thì dùng
  `bg-muted`:

  ```tsx
  {/* SAI */}
  <div className="rounded-xl bg-card p-4">
    <div className="rounded-lg bg-card p-3">…</div>
  </div>

  {/* ĐÚNG */}
  <div className="rounded-xl bg-card p-4">
    <div className="rounded-lg bg-muted p-3">…</div>
  </div>
  ```

---

## `COLOUR-11` — vùng nhóm nhẹ

### Trường hợp: khối tóm tắt bên trong một thẻ

```tsx
<article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-foreground">
  <h3 className="text-base font-semibold text-foreground">Đơn hàng #4821</h3>
  <div className="flex items-baseline justify-between rounded-lg bg-muted p-3">
    <span className="text-sm text-muted-foreground">Tổng cộng</span>
    <span className="font-semibold tabular-nums text-foreground">1.290.000đ</span>
  </div>
</article>
```

### Trường hợp: khối mã trong một bài viết

```tsx
<pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm text-foreground">
  <code>{snippet}</code>
</pre>
```

### Ngoại lệ và nhầm lẫn

- **`bg-muted` không phải nền của mục đang chọn.** Trạng thái chọn dùng `bg-primary/10`, vì nó nói
  trạng thái chọn chứ không nói nhóm.

  ```tsx
  {/* SAI */}  <li aria-selected="true" className="bg-muted">Chương 3</li>
  {/* ĐÚNG */} <li aria-selected="true" className="bg-primary/10 text-primary">Chương 3</li>
  ```

- **Đừng vừa `bg-muted` vừa `border-border` để nói một chuyện.** Gom bằng nền, tách bằng viền; làm cả
  hai là nói hai lần một ranh giới.

---

## `COLOUR-12` — đường ranh trung tính

### Trường hợp: đường phân cách giữa các hàng

```tsx
<ul className="divide-y divide-border rounded-lg border border-border">
  <li className="p-4 text-foreground">Thông báo qua email</li>
  <li className="p-4 text-foreground">Thông báo đẩy</li>
</ul>
```

### Trường hợp: ô nhập liệu ở trạng thái bình thường

```tsx
<input className="rounded-md border border-border bg-background px-3 py-2 text-foreground" type="text" />
```

### Ngoại lệ và nhầm lẫn

- **Viền chỉ đổi mã khi trạng thái đổi.** `border-border` → `border-danger` chỉ sau khi đã kiểm tra tính hợp lệ và
  thật sự không hợp lệ.

  ```tsx
  {/* Bình thường */}      <input className="border border-border" />
  {/* Sau khi validate */} <input aria-invalid="true" className="border border-danger" />
  ```

- **Đừng dùng viền màu để trang trí.** Một viền tím quanh một thẻ trung tính là một trạng thái không
  tồn tại đang được thông báo.

---

## `COLOUR-13` — các hạng mục dữ liệu độc lập

### Trường hợp: chú giải có nhãn và giá trị

```tsx
<ul aria-label="Phân bổ thời gian học" className="flex flex-col gap-2">
  <li className="flex items-center gap-2 text-sm text-foreground">
    <span aria-hidden="true" className="size-3 rounded-sm bg-chart-1" />
    Thiết kế hệ thống · 52%
  </li>
  <li className="flex items-center gap-2 text-sm text-foreground">
    <span aria-hidden="true" className="size-3 rounded-sm bg-chart-2" />
    Thuật toán · 31%
  </li>
  <li className="flex items-center gap-2 text-sm text-foreground">
    <span aria-hidden="true" className="size-3 rounded-sm bg-chart-3" />
    Cơ sở dữ liệu · 17%
  </li>
</ul>
```

Mỗi chuỗi dữ liệu mang **giá trị** ngay trong nhãn, nên biểu đồ vẫn đọc được khi in đen trắng.

### Trường hợp: thêm hoa văn cho trường hợp in ấn

```tsx
<ul aria-label="Nguồn truy cập" className="flex flex-col gap-2">
  <li className="flex items-center gap-2 text-sm text-foreground">
    <span aria-hidden="true" className="size-3 rounded-sm bg-chart-1" />
    Trực tiếp · 40%
  </li>
  <li className="flex items-center gap-2 text-sm text-foreground">
    <span aria-hidden="true" className="size-3 rounded-sm border border-border bg-chart-1/40" />
    Giới thiệu · 35%
  </li>
</ul>
```

Hai chuỗi dữ liệu cùng sắc màu nhưng khác **độ đặc và có viền**, nên vẫn tách được khi mất màu.

### Ngoại lệ và nhầm lẫn

- **Ba lát "đạt / cảnh báo / hỏng" không phải `COLOUR-13`.** Đó là ba trạng thái, dùng đúng ba mã
  trạng thái:

  ```tsx
  {/* SAI — trạng thái bị vẽ như hạng mục */}
  <li><span className="bg-chart-1" />Đạt</li>
  <li><span className="bg-chart-2" />Cảnh báo</li>
  <li><span className="bg-chart-3" />Hỏng</li>

  {/* ĐÚNG */}
  <li className="text-success">✓ Đạt · 82</li>
  <li className="text-warning">! Cảnh báo · 11</li>
  <li className="text-danger">× Hỏng · 7</li>
  ```

- **Ánh xạ phải ổn định.** Hạng mục thứ ba không được đổi màu chỉ vì lần hiển thị này nó rơi xuống
  hạng tư.

---

## `COLOUR-14` — tác phẩm đồ hoạ thương hiệu

### Trường hợp: biểu trưng giữ bảng màu riêng, giao diện quanh nó thì không

```tsx
<header className="flex items-center justify-between border-b border-border bg-background p-4">
  <img alt="Logo" className="h-8 w-auto" src="/brand/logo.svg" />
  <a className="text-sm text-primary hover:underline" href="/dang-nhap">Đăng nhập</a>
</header>
```

### Ngoại lệ và nhầm lẫn

- **Ngoại lệ dừng ở mép của tác phẩm đồ hoạ.** Một biểu trưng cam không cho phép một nút cam:

  ```tsx
  {/* SAI */}  <button className="bg-[#ff6a00] text-white" type="button">Bắt đầu học</button>
  {/* ĐÚNG */} <button className="bg-primary text-primary-foreground" type="button">Bắt đầu học</button>
  ```

---

## `COLOUR-15` — chữ trên ảnh

### Trường hợp: tiêu đề trên ảnh bìa do người dùng tải lên

```tsx
<div className="relative overflow-hidden rounded-xl">
  <img alt="" className="h-48 w-full object-cover" src={cover} />
  <div className="absolute inset-0 bg-black/50" />
  <h3 className="absolute inset-x-4 bottom-4 text-lg font-semibold text-white">
    Nền tảng thiết kế hệ thống
  </h3>
</div>
```

Phần tử chồng lớp tồn tại để **bảo đảm độ tương phản** trên một nền không đoán trước được, không phải để ảnh trông
"nghệ" hơn. Đây là chỗ duy nhất trong mô-đun mà một giá trị màu tuyệt đối được chấp nhận, và nó bị
giới hạn trong đúng cặp phần tử chồng lớp + chữ.

### Ngoại lệ và nhầm lẫn

- **Nền đã xác định thì không cần phần tử chồng lớp.** Nếu phía sau là một bề mặt do chủ đề kiểm soát, dùng
  `COLOUR-10`:

  ```tsx
  {/* SAI */}  <div className="bg-black/50"><p className="text-white">Tổng quan</p></div>
  {/* ĐÚNG */} <div className="rounded-xl bg-card p-4"><p className="text-foreground">Tổng quan</p></div>
  ```

---

## Mã lồng mã — một phần tử, một vai trò

Luật *một phần tử một vai trò* chỉ nhìn thấy được khi các mã **lồng** vào nhau. Ba ví dụ dưới đây cho
thấy cùng một cây mã đánh dấu mang nhiều mã ở nhiều tầng.

### Trường hợp: thẻ trạng thái đơn hàng — sáu mã trong một cây

```tsx
<main className="bg-background p-6 text-foreground">
  <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-foreground">
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-foreground">Đơn hàng #4821</h3>
        <p className="text-sm text-muted-foreground">Đặt ngày 12/08/2026</p>
      </div>
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">
        <span aria-hidden="true">✓</span>
        Đã thanh toán
      </span>
    </div>
    <div className="flex items-baseline justify-between rounded-lg bg-muted p-3">
      <span className="text-sm text-muted-foreground">Tổng cộng</span>
      <span className="font-semibold tabular-nums text-foreground">1.290.000đ</span>
    </div>
    <a className="text-sm font-medium text-primary hover:underline" href="/don-hang/4821">Xem chi tiết</a>
  </article>
</main>
```

Đọc từ ngoài vào: `COLOUR-9` cho nền trang · `COLOUR-10` cho thẻ · `COLOUR-12` cho viền thẻ ·
`COLOUR-1` cho tiêu đề và số tiền · `COLOUR-2` cho ngày đặt và nhãn "Tổng cộng" · `COLOUR-4` cho
nhãn trạng thái · `COLOUR-11` cho khối tổng tiền · `COLOUR-3` cho liên kết.

Điều quan trọng: **không** nút DOM nào mang hai vai trò. Thẻ không tự tô thành công để "khoe" là đã thanh
toán — trạng thái đó thuộc về nhãn trạng thái, là một phần tử con.

### Trường hợp: trường trong biểu mẫu có lỗi — trạng thái nằm ở con, không nằm ở nhóm

```tsx
<fieldset className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
  <legend className="text-sm font-medium text-foreground">Thông tin liên hệ</legend>

  <label className="flex flex-col gap-1">
    <span className="text-sm text-foreground">Họ và tên</span>
    <input className="rounded-md border border-border bg-background px-3 py-2 text-foreground focus-visible:ring-2 focus-visible:ring-ring" />
  </label>

  <label className="flex flex-col gap-1">
    <span className="text-sm text-foreground">Email</span>
    <input
      aria-describedby="mail-err"
      aria-invalid="true"
      className="rounded-md border border-danger bg-background px-3 py-2 text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    />
    <span className="text-sm text-danger" id="mail-err">Email không đúng định dạng.</span>
  </label>

  <button
    className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground opacity-50"
    disabled
    type="submit"
  >
    Lưu
  </button>
</fieldset>
```

`fieldset` giữ `COLOUR-10` + `COLOUR-12` và **không** đổi sang đỏ chỉ vì một trường nhập liệu bên trong hỏng. Lỗi
là chuyện của trường nhập liệu đó. Nút vẫn `COLOUR-8`, không phải `COLOUR-6` — chưa dùng được thì khác với hỏng.

### Trường hợp: hàng vừa đang chọn, vừa nhận tiêu điểm, vừa mang trạng thái

```tsx
<ul className="divide-y divide-border rounded-lg border border-border bg-card">
  <li>
    <button
      aria-current="true"
      className="flex w-full items-center justify-between gap-4 bg-primary/10 p-4 text-left text-primary focus-visible:ring-2 focus-visible:ring-ring"
      type="button"
    >
      <span className="flex items-center gap-2">
        <span aria-hidden="true">✓</span>
        Chương 3 · Nhất quán và đồng thuận
      </span>
      <span className="inline-flex items-center gap-1 text-xs text-warning">
        <span aria-hidden="true">!</span>
        Hạn nộp còn 2 ngày
      </span>
    </button>
  </li>
  <li>
    <button
      className="flex w-full items-center justify-between gap-4 p-4 text-left text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      type="button"
    >
      <span>Chương 4 · Phân vùng dữ liệu</span>
      <span className="text-xs text-muted-foreground">Chưa bắt đầu</span>
    </button>
  </li>
</ul>
```

Ba trạng thái sống chung mà không đè nhau: trạng thái chọn ở nền (`COLOUR-3`), tiêu điểm ở vòng (`COLOUR-7`),
cảnh báo ở một phần tử con riêng (`COLOUR-5`). Nếu gộp cảnh báo vào chính nút, hàng sẽ không còn nói
được "đang chọn" nữa.

---

## Ánh xạ yêu cầu sang class CSS

Nêu phần tử, vai trò và trạng thái. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu cụ thể rồi
dừng. Câu trả lời phải là một chuỗi class CSS **hoặc** một câu hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| "Hiện thời gian đăng ngay dưới tiêu đề bài viết" | Mốc thời gian hỗ trợ cho tiêu đề | `COLOUR-2` | `text-muted-foreground` |
| "Cho thấy đã thanh toán xong" | Có trạng thái thật trong dữ liệu | `COLOUR-4` | `text-success` + biểu tượng + chữ "Đã thanh toán" |
| "Làm cái tiêu đề này màu xanh cho quan trọng hơn" | Không có vai trò mới; cấp bậc là việc của kiểu chữ | `COLOUR-1` | `text-xl font-semibold text-foreground` |
| "Cho ô nhập liệu đang gõ một dấu hiệu bàn phím" | Vị trí bàn phím, không phải dữ liệu | `COLOUR-7` | `focus-visible:ring-2 focus-visible:ring-ring` |
| "Đánh dấu mục đang mở trong trình đơn" | Trạng thái chọn tồn tại lâu | `COLOUR-3` | `bg-primary/10 text-primary` + `aria-current` |
| "Thêm một khung nhẹ bên trong thẻ" | Nhóm phụ, không tự đứng được | `COLOUR-11` | `bg-muted text-foreground` |
| "Báo là thẻ sắp hết hạn" | Chưa hỏng, còn cứu được | `COLOUR-5` | `text-warning` + chữ nói rõ mốc thời gian |
| "Báo là nạp tiền không thành công" | Đã thất bại | `COLOUR-6` | `text-danger` + lý do đọc được |
| "Nút này chưa bấm được vì chưa chọn gói" | Điều kiện nghiệp vụ chưa thoả | `COLOUR-8` | `text-muted-foreground opacity-50` + `disabled` |
| "Kẻ một đường giữa các dòng" | Ranh giới trung tính | `COLOUR-12` | `border-border` / `divide-border` |
| "Vẽ ba nguồn truy cập cho dễ so sánh" | Hạng mục ngang hàng | `COLOUR-13` | bảng màu phân loại + nhãn và giá trị |
| "Đặt tiêu đề lên ảnh bìa" | Nền không đoán trước được | `COLOUR-15` | phần tử chồng lớp theo độ tương phản + chữ tương phản |
| "Làm chỗ này mềm hơn một chút" | Chưa xác lập được vai trò | — | Hỏi một câu: nội dung này hỗ trợ cho nội dung chính nào? |
| "Cho nó màu xanh lá" | Chưa rõ là trạng thái hay trang trí | — | Hỏi một câu: xanh ở đây có nghĩa là "đã thành công" không? |

Hai dòng cuối là hai dòng **duy nhất** được phép trả về câu hỏi. Mọi dòng còn lại đã có đủ dữ kiện.

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `COLOUR-1` / `COLOUR-2` | Bỏ qua dòng này thì người dùng có mất thông tin bắt buộc để hành động không? |
| `COLOUR-1` / `COLOUR-3` | Phần tử này có bấm được, hoặc có đang khai báo vị trí hiện tại không? |
| `COLOUR-2` / `COLOUR-8` | Có một trạng thái `disabled` thật, hay chỉ là cấp bậc đọc thấp hơn? |
| `COLOUR-3` / `COLOUR-4` | Đây là hành động sẽ xảy ra, hay kết quả đã xảy ra? |
| `COLOUR-3` / `COLOUR-7` | Thứ này còn lại sau khi bấm Thẻ tab đi chỗ khác không? |
| `COLOUR-4` / `COLOUR-1` | Trong dữ liệu có trường nhập liệu trạng thái để trỏ vào, hay chỉ là nội dung nghe tích cực? |
| `COLOUR-5` / `COLOUR-6` | Việc đã hỏng rồi, hay mới chỉ sắp hỏng nếu không ai can thiệp? |
| `COLOUR-6` / `COLOUR-12` | Đã kiểm tra tính hợp lệ và thật sự không hợp lệ chưa? |
| `COLOUR-6` / `COLOUR-8` | Có một thất bại, hay chỉ là một điều kiện chưa thoả? |
| `COLOUR-9` / `COLOUR-10` | Bên dưới phần tử này còn bề mặt nào nữa không? |
| `COLOUR-10` / `COLOUR-11` | Khối này có tự đứng được khi mang ra khỏi bề mặt cha không? |
| `COLOUR-11` / `COLOUR-12` | Cần **gom** một vùng, hay chỉ cần **tách** hai vùng? |
| `COLOUR-13` / `COLOUR-4,5,6` | Các lát này ngang hàng, hay chúng là ba trạng thái? |
| `COLOUR-14` / mọi mã khác | Đây là tác phẩm đồ hoạ, hay là giao diện đang mượn màu thương hiệu? |
| `COLOUR-15` / `COLOUR-10` | Nền phía sau có do chủ đề kiểm soát không? |

## Sai lầm lặp lại nhiều nhất

1. Tô `text-primary` cho tiêu đề tĩnh để nó nổi hơn.
2. Làm mờ một điều kiện nghiệp vụ vì nó "dài quá".
3. Suy ra thành công từ nội dung nghe tích cực.
4. Báo lỗi đỏ trước khi kiểm tra tính hợp lệ.
5. Đổi viền sang đỏ mà không kèm thông điệp.
6. Gỡ `outline` mà không thay bằng vòng.
7. `opacity-50` không đi kèm `disabled`, hoặc ngược lại.
8. Lồng `bg-card` trong `bg-card` rồi thắc mắc sao không thấy tầng.
9. Viết hex hoặc bảng màu thô vì "chủ đề hiện tại đang ra đúng màu đó".
10. Vẽ ba trạng thái thành một bảng màu phân loại của biểu đồ.
11. Cho một nút DOM mang hai vai trò thay vì lồng một nút DOM con.
12. Đổi màu trong lúc đang tải rồi đổi lại khi có dữ liệu.
