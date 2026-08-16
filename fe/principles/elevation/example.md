---
id: fe-principles-elevation-example
title: example.md
slug: /fe/principles/elevation/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp và ngoại lệ của từng mã ELEVATION-N, viết bằng className thuần.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `elevation` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **mã đánh dấu thường với `className` thường**. Không thư viện thành phần, không thiết kế
hệ thống riêng, không khoá đăng ký. Một luật chỉ đúng khi nó đúng ở bất kỳ giao diện nào — nên nếu một
ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó sai chỗ.

Mỗi mã có **nhiều trường hợp**, rồi tới **ngoại lệ** và **những thứ trông giống nhưng không phải mã đó**.
Có nhiều ví dụ **mã lồng mã**, vì luật *bậc đo từ nền cục bộ* chỉ nhìn thấy được khi hai mã nằm trong
nhau. Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một chuỗi class CSS duy nhất.

**Về tên bóng.** `shadow-surface`, `shadow-popover` và `shadow-dialog` là **ba tên ngữ nghĩa** mà front
end nào cũng tự định nghĩa được: một mức cho thứ đang **nằm nghỉ**, một mức cho thứ được **gọi ra**,
một mức cho thứ **chặn cả trang**. `popover` và `dialog` là từ của nền tảng web cho hai hành vi đó,
không phải tên của một thành phần nào. Ba mức, không hơn: mức thứ tư là thị hiếu, không phải độ cao.
`bg-muted`, `border-border` và `inset-shadow-sm` cũng vậy — một nền chìm, một màu ranh giới, một bóng
hắt vào trong.

**Về những class CSS không phải đầu ra của mô-đun này.** Trong ví dụ vẫn có `absolute`, `fixed`, `sticky`,
`p-*`, `gap-*` và `rounded-*` vì mã đánh dấu thật có chúng, nhưng chúng thuộc các mô-đun khác. Quyết định
của mô-đun này luôn chỉ là bậc và thứ tự.

---

## `ELEVATION-0` — nằm trong mặt phẳng của nền

*không khai báo class CSS độ nổi*

### Trường hợp: khối mô tả bên trong một thẻ

```tsx
<article className="rounded-2xl bg-card p-4 shadow-surface">
  <h3 className="font-medium">Thiết kế hệ thống phân tán</h3>
  <p className="mt-1 text-sm text-neutral-500">20 bài · 14 giờ</p>
</article>
```

Thẻ là `ELEVATION-1`. Cả `h3` lẫn `p` là `ELEVATION-0`: chúng không che gì, và độ cao của chúng đã
được thẻ tuyên bố hộ.

### Trường hợp: hàng trong một danh sách đã có đường phân cách

```tsx
<ul className="divide-y rounded-2xl bg-card shadow-surface">
  <li className="p-4">Thông báo qua email</li>
  <li className="p-4">Thông báo đẩy</li>
  <li className="p-4">Bản tin hằng tuần</li>
</ul>
```

### Trường hợp: gợi ý dưới ô nhập liệu

```tsx
<div className="flex flex-col gap-1">
  <input className="rounded-md border px-3 py-2" id="slug" />
  <p className="text-xs text-neutral-500">Chỉ dùng chữ thường và dấu gạch ngang.</p>
</div>
```

### Trường hợp: thẻ lồng trong thẻ — nền đã dịch lên rồi

```tsx
<section className="rounded-2xl bg-card p-4 shadow-surface">
  <h2 className="font-medium">Thiết bị đang đăng nhập</h2>
  <div className="mt-3 flex flex-col gap-2">
    <article className="rounded-xl p-3">Máy tính · Hà Nội · 2 giờ trước</article>
    <article className="rounded-xl p-3">Điện thoại · Hà Nội · hôm qua</article>
  </div>
</section>
```

Hai `article` bên trong là `ELEVATION-0`. Chúng đã được phần nội dung bê lên; tự nâng thêm một lần nữa là
nói rằng chúng cao hơn chính vật chủ đang đỡ chúng.

### Ngoại lệ và nhầm lẫn

- **Không viết `shadow-none` khi chưa từng có bóng.** Không tuyên bố khác với tuyên bố bằng không.

  ```tsx
  {/* SAI */}  <p className="mt-1 text-sm shadow-none">20 bài · 14 giờ</p>
  {/* ĐÚNG */} <p className="mt-1 text-sm">20 bài · 14 giờ</p>
  ```

- **Không viết `z-0`.** Nó ghim phần tử vào một cuộc so sánh mà nó không tham gia, và tệ hơn: nó tạo
  ra một ngữ cảnh xếp chồng mới nếu phần tử đang được định vị, khoá luôn mọi thứ bên trong.

  ```tsx
  {/* SAI */}  <div className="relative z-0"><span className="absolute -top-2 end-0 z-40">Mới</span></div>
  ```

- **Bóng chồng bóng trong cùng một mặt phẳng:**

  ```tsx
  {/* SAI */}
  <section className="rounded-2xl bg-card p-4 shadow-surface">
    <article className="rounded-xl bg-card p-3 shadow-surface">Máy tính · Hà Nội</article>
  </section>
  ```

  Hai cái bóng giống hệt nhau nói rằng article cao hơn phần nội dung đúng bằng lượng mà phần nội dung cao hơn
  trang. Điều đó không đúng, và mắt sẽ đọc ra ngay.

---

## `ELEVATION-1` — đối tượng độc lập nằm yên trên nền

`shadow-surface`

### Trường hợp: thẻ khoá học trên trang danh mục

```tsx
<article className="rounded-2xl bg-card p-4 shadow-surface">
  <h3 className="font-medium">Nền tảng hệ thống</h3>
  <p className="mt-1 text-sm text-neutral-500">Nhập môn · 6 bài</p>
</article>
```

### Trường hợp: thẻ tóm tắt đơn hàng

```tsx
<aside className="rounded-2xl bg-card p-4 shadow-surface">
  <h2 className="font-medium">Tóm tắt đơn hàng</h2>
  <dl className="mt-3 flex flex-col gap-2 text-sm">
    <div className="flex justify-between"><dt>Tạm tính</dt><dd className="tabular-nums">799.000đ</dd></div>
    <div className="flex justify-between"><dt>Giảm giá</dt><dd className="tabular-nums">-80.000đ</dd></div>
  </dl>
</aside>
```

### Trường hợp: biểu mẫu đăng nhập đặt giữa trang

```tsx
<main className="grid min-h-screen place-items-center p-4">
  <form className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-surface">
    <h1 className="font-medium">Đăng nhập</h1>
    <input className="mt-4 w-full rounded-md border px-3 py-2" type="email" />
    <button className="mt-3 w-full rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="submit">Tiếp tục</button>
  </form>
</main>
```

Biểu mẫu ở giữa màn hình vẫn là `ELEVATION-1`, không phải `ELEVATION-3`: không có lớp nền mờ, không có gì
phía sau bị lấy đi, và nó có mặt ngay khi trang hiển thị.

### Trường hợp: khung chờ giữ nguyên bậc

```tsx
<article className="rounded-2xl bg-card p-4 shadow-surface">
  <span className="block h-5 w-40 rounded bg-neutral-200" />
  <span className="mt-2 block h-4 w-24 rounded bg-neutral-200" />
</article>
```

### Ngoại lệ và nhầm lẫn

- **Chỉ có một mức bóng nghỉ.** "Thẻ thường" và "thẻ nổi bật" không phải hai độ cao.

  ```tsx
  {/* SAI */}  <article className="rounded-2xl bg-card p-4 shadow-surface-lg">Khoá học nổi bật</article>
  {/* ĐÚNG */} <article className="rounded-2xl bg-card p-4 shadow-surface ring-2 ring-neutral-900">Khoá học nổi bật</article>
  ```

  Muốn nhấn mạnh thì nhấn bằng màu, viền hoặc kích thước. Nâng bậc để "nổi bật hơn" là mượn thang độ
  cao đi làm việc của thang chú ý, và sau đó không thang nào còn đọc được.

- **Không vừa bóng vừa viền:**

  ```tsx
  {/* SAI */}  <article className="rounded-2xl border border-border bg-card p-4 shadow-surface">…</article>
  ```

- **Bóng không đổi khi rê chuột.**

  ```tsx
  {/* SAI */}  <article className="rounded-2xl bg-card p-4 shadow-surface hover:shadow-popover">…</article>
  ```

  Con trỏ đi qua không làm thẻ nhấc lên khỏi trang. Muốn phản hồi rê chuột thì đổi nền hoặc viền.

---

## `ELEVATION-2` — lớp được gọi ra

`z-30 shadow-popover`

### Trường hợp: trình đơn tài khoản

```tsx
<div className="relative">
  <button className="rounded-md border px-3 py-2 text-sm" type="button">Tài khoản</button>
  <div className="absolute end-0 top-full z-30 mt-2 w-56 rounded-xl bg-card p-1 shadow-popover" role="menu">
    <button className="w-full rounded-lg px-3 py-2 text-start text-sm" role="menuitem" type="button">Hồ sơ</button>
    <button className="w-full rounded-lg px-3 py-2 text-start text-sm" role="menuitem" type="button">Cài đặt</button>
    <button className="w-full rounded-lg px-3 py-2 text-start text-sm" role="menuitem" type="button">Đăng xuất</button>
  </div>
</div>
```

Ba nút bên trong là `ELEVATION-0`: khung đã bê chúng lên rồi.

### Trường hợp: gợi ý autocomplete của ô tìm kiếm

```tsx
<div className="relative">
  <input aria-label="Tìm khoá học" className="w-full rounded-md border px-3 py-2" />
  <ul className="absolute inset-x-0 top-full z-30 mt-1 divide-y rounded-xl bg-card shadow-popover" role="listbox">
    <li className="px-3 py-2 text-sm" role="option">Hệ thống phân tán</li>
    <li className="px-3 py-2 text-sm" role="option">Hệ quản trị cơ sở dữ liệu</li>
  </ul>
</div>
```

### Trường hợp: cửa sổ nổi giải thích một chỉ số

```tsx
<div className="relative inline-block">
  <button aria-describedby="tip" className="text-sm underline" type="button">Tỷ lệ hoàn thành</button>
  <div className="absolute start-0 top-full z-30 mt-2 w-64 rounded-xl bg-card p-3 text-sm shadow-popover" id="tip" role="tooltip">
    Tính trên số bài đã nộp trong 30 ngày gần nhất.
  </div>
</div>
```

### Trường hợp: trình đơn ngữ cảnh

```tsx
<div className="fixed z-30 w-48 rounded-xl bg-card p-1 shadow-popover" role="menu" style={{ left: x, top: y }}>
  <button className="w-full rounded-lg px-3 py-2 text-start text-sm" role="menuitem" type="button">Đổi tên</button>
  <button className="w-full rounded-lg px-3 py-2 text-start text-sm" role="menuitem" type="button">Nhân bản</button>
</div>
```

### Trường hợp: khung thông báo gọi từ chrome cấp trang

```tsx
<header className="sticky top-0 z-50 flex items-center justify-between bg-card px-4 py-3">
  <span className="font-medium">Bảng điều khiển</span>
  <div className="relative">
    <button className="rounded-md border px-3 py-2 text-sm" type="button">Thông báo</button>
    <div className="absolute end-0 top-full z-30 mt-2 w-80 rounded-xl bg-card shadow-popover">
      <ul className="divide-y">
        <li className="p-3 text-sm">Bài nộp của bạn đã được chấm</li>
        <li className="p-3 text-sm">Khoá học mới trong danh mục bạn theo dõi</li>
      </ul>
    </div>
  </div>
</header>
```

Phần đầu là `ELEVATION-4` ở bậc `z-50`. Khung bên trong ghi `z-30` mà vẫn nằm trên mọi thứ, vì phần đầu
đã mở một ngữ cảnh xếp chồng riêng và `z-30` chỉ so sánh **bên trong** ngữ cảnh đó. Đây là lý do phải
biết ngữ cảnh roots trước khi tranh luận về con số.

### Ngoại lệ và nhầm lẫn

- **Nền trong suốt là lỗi, không phải phong cách:**

  ```tsx
  {/* SAI */}  <div className="absolute top-full z-30 rounded-xl bg-card/60 p-3 shadow-popover">…</div>
  ```

  Lớp này đè lên chữ. Nền phải đục, nếu không hai lớp chữ chồng lên nhau và cái bóng chỉ làm cho sự
  chồng chéo trông có chủ ý.

- **Có bóng mà không có thứ tự là chưa xong:**

  ```tsx
  {/* SAI */}  <div className="absolute top-full mt-2 rounded-xl bg-card p-3 shadow-popover">…</div>
  ```

- **Bỏ qua nó mà mất dữ liệu thì nó là `ELEVATION-3`.** Một khung "gọi ra" nhưng chứa biểu mẫu đang nhập
  dở, bấm ra ngoài là mất hết, thì nó không còn là lớp bỏ qua được nữa — nó là lớp chặn, và phải
  có lớp nền mờ để nói đúng điều đó.

- **Tổ tiên có `transform` thì số nào cũng vô nghĩa:**

  ```tsx
  {/* SAI — layer bị nhốt trong context do transform của cha tạo ra */}
  <div className="transition-transform hover:scale-105">
    <div className="absolute top-full z-30 rounded-xl bg-card p-3 shadow-popover">…</div>
  </div>
  ```

---

## `ELEVATION-3` — lớp lấy cả trang đi

`z-[60] shadow-dialog` + lớp nền mờ

### Trường hợp: xác nhận xoá

```tsx
<div className="fixed inset-0 z-[60] bg-black/50" />
<div aria-modal="true" className="fixed inset-0 z-[60] grid place-items-center p-4" role="dialog">
  <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-dialog">
    <h2 className="font-medium">Xoá khoá học này?</h2>
    <p className="mt-2 text-sm text-neutral-500">Tiến độ của 128 học viên sẽ không khôi phục được.</p>
    <div className="mt-4 flex justify-end gap-2">
      <button className="rounded-md border px-3 py-2 text-sm" type="button">Huỷ</button>
      <button className="rounded-md bg-red-600 px-3 py-2 text-sm text-white" type="button">Xoá</button>
    </div>
  </div>
</div>
```

### Trường hợp: bảng trượt trượt lên từ đáy trên thiết bị di động

```tsx
<div className="fixed inset-0 z-[60] bg-black/50" />
<div aria-modal="true" className="fixed inset-x-0 bottom-0 z-[60] rounded-t-2xl bg-card p-4 shadow-dialog" role="dialog">
  <h2 className="font-medium">Chọn phương thức thanh toán</h2>
  <div className="mt-3 flex flex-col gap-2">
    <label className="flex items-center gap-2 rounded-xl p-3 text-sm"><input name="pay" type="radio" />Thẻ nội địa</label>
    <label className="flex items-center gap-2 rounded-xl p-3 text-sm"><input name="pay" type="radio" />Ví điện tử</label>
  </div>
</div>
```

Bảng trượt và hộp thoại là **một** mã. Hướng đi vào là chuyện của hoạt ảnh; điều làm nên `ELEVATION-3` là
trang phía sau đã ngừng dùng được.

### Trường hợp: mã lồng mã — hộp thoại chứa thẻ, thẻ chứa giếng

```tsx
<div aria-modal="true" className="fixed inset-0 z-[60] grid place-items-center p-4" role="dialog">
  <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-dialog">
    <h2 className="font-medium">Nâng cấp gói học</h2>
    <div className="mt-4 rounded-xl p-4">
      <p className="text-sm">Bạn đang dùng 8 trên 10 chỗ ngồi.</p>
      <div className="mt-3 h-2 rounded-full bg-muted inset-shadow-sm">
        <div className="h-2 w-4/5 rounded-full bg-neutral-900 shadow-surface" />
      </div>
    </div>
  </div>
</div>
```

Bốn mã trong một cây: hộp thoại là `ELEVATION-3`; khối `rounded-xl p-4` bên trong nó là `ELEVATION-0`;
máng tiến độ là `ELEVATION-6`; thanh chạy trong máng là `ELEVATION-1` **đo từ đáy máng**. Không chỗ
nào lặp lại tuyên bố của chỗ nào.

### Trường hợp: trình xem ảnh toàn màn hình

```tsx
<div aria-modal="true" className="fixed inset-0 z-[60] bg-black/90" role="dialog">
  <img alt="Ảnh chứng chỉ" className="mx-auto max-h-full max-w-full object-contain" src={src} />
  <button className="absolute end-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white" type="button">Đóng</button>
</div>
```

Nút đóng là `ELEVATION-4` ở bậc `1`, so sánh **bên trong** lớp chặn — không phải một bậc mới trên
thang của trang.

### Ngoại lệ và nhầm lẫn

- **Không leo lên trên bậc trên cùng:**

  ```tsx
  {/* SAI */}  <div className="fixed inset-0 z-[999] bg-black/50" />
  {/* SAI */}  <div className="fixed inset-0 z-[70] bg-black/50" />
  ```

  Nếu `z-[60]` không thắng, nguyên nhân là ngữ cảnh xếp chồng hoặc thứ tự nguồn, và cả hai đều không
  sửa được bằng một con số to hơn.

- **Lớp chặn mở từ trong một lớp khác thì lồng vào, đừng leo số:**

  ```tsx
  {/* SAI */}
  <div className="absolute top-full z-30 rounded-xl bg-card p-3 shadow-popover">
    <button type="button">Cài đặt</button>
  </div>
  <div className="fixed inset-0 z-[70] bg-black/50" />

  {/* ĐÚNG — view thứ hai render ngay trong panel đã mở */}
  <div className="absolute top-full z-30 w-80 rounded-xl bg-card shadow-popover">
    <div className="p-3">
      <button className="text-sm" type="button">← Quay lại</button>
      <div className="mt-3 rounded-xl border border-border p-3">…cài đặt…</div>
    </div>
  </div>
  ```

- **Cold-load phủ kín không phải `ELEVATION-3`.** Nó ngồi ở bậc `6` nhưng không hỏi gì cả, nên nó là
  `ELEVATION-4`:

  ```tsx
  <div aria-hidden="true" className="fixed inset-0 z-[60] grid place-items-center bg-background">
    <span className="text-sm text-neutral-500">Đang tải…</span>
  </div>
  ```

- **Lớp nền mờ không có bóng.** Lớp nền mờ không phải một vật thể; nó là sự vắng mặt của trang.

  ```tsx
  {/* SAI */}  <div className="fixed inset-0 z-[60] bg-black/50 shadow-dialog" />
  ```

---

## `ELEVATION-4` — viết thứ tự ra

`z-<bậc>`, không bóng

### Trường hợp: thanh lọc dính dưới trên thanh

```tsx
<div className="sticky top-16 z-30 bg-background py-2">
  <div className="flex flex-wrap gap-2">
    <button className="rounded-full border px-3 py-1 text-sm" type="button">Tất cả</button>
    <button className="rounded-full border px-3 py-1 text-sm" type="button">Đang học</button>
  </div>
</div>
```

Cùng con số `z-30` với một danh sách thả xuống, nhưng khác mã: cái này **luôn ở đó** và không do ai gọi ra. Số là
phương tiện; mã là tình huống.

### Trường hợp: thanh điều khiển đè lên khung video

```tsx
<div className="relative overflow-hidden rounded-2xl bg-black">
  <video className="w-full" src={src} />
  <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 bg-black/60 p-3">
    <button className="text-sm text-white" type="button">Phát</button>
    <div className="h-1 flex-1 rounded-full bg-white/30" />
  </div>
</div>
```

### Trường hợp: nhãn trạng thái đè lên góc ảnh thu nhỏ

```tsx
<div className="relative">
  <img alt="" className="w-full rounded-xl" src={thumb} />
  <span className="absolute end-2 top-2 z-10 rounded-full bg-neutral-900 px-2 py-0.5 text-xs text-white">Mới</span>
</div>
```

Bậc `1`: chrome nổi **bên trong một thành phần**, không so với bất cứ thứ gì ngoài nó.

### Trường hợp: nút nổi cấp trang

```tsx
<button className="fixed bottom-4 end-4 z-40 rounded-full bg-neutral-900 px-4 py-3 text-sm text-white" type="button">
  Hỏi trợ giảng
</button>
```

### Trường hợp: thanh tiến trình điều hướng phải vượt trên thanh

```tsx
<div aria-hidden="true" className="fixed inset-x-0 top-0 z-[60] h-[3px] bg-neutral-900" style={{ width: progress }} />
```

### Trường hợp: trang trí nền phải nằm sau chữ

```tsx
<section className="relative isolate overflow-hidden rounded-2xl p-8">
  <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-br from-neutral-100 to-transparent" />
  <h2 className="font-medium">Lộ trình của bạn</h2>
  <p className="mt-1 text-sm text-neutral-500">Còn 4 mô-đun nữa là hoàn thành.</p>
</section>
```

`isolate` ở đây là một quyết định `ELEVATION-4` cố ý: nó mở một ngữ cảnh xếp chồng để `-z-10` không tụt
xuống dưới nền của trang và biến mất.

### Trường hợp: nổi lên khi cuộn — ngoại lệ được viết ra

```tsx
<header className={`sticky top-0 z-50 bg-card px-4 py-3 ${scrolled ? "shadow-surface" : ""}`}>
  <span className="font-medium">Bảng điều khiển</span>
</header>
```

Trước khi cuộn, phần đầu không che gì: `ELEVATION-4` thuần tuý. Sau khi cuộn, nó thật sự có nội dung
chui xuống dưới, nên tuyên bố `ELEVATION-1` mới trở thành đúng. Bóng xuất hiện vì sự thật đổi, không
vì hiệu ứng.

### Ngoại lệ và nhầm lẫn

- **Không có bậc giữa hai bậc:**

  ```tsx
  {/* SAI */}  <div className="sticky top-16 z-[45] bg-background">…</div>
  ```

- **Không dùng số to cho chắc:**

  ```tsx
  {/* SAI */}  <div className="sticky top-0 z-[9999] bg-card">…</div>
  ```

- **Thứ tự không kéo theo độ cao:**

  ```tsx
  {/* SAI */}  <span className="absolute end-2 top-2 z-10 rounded-full bg-neutral-900 px-2 py-0.5 shadow-surface">Mới</span>
  ```

  Nhãn trạng thái cần ở trước ảnh, không cần nhấc lên khỏi ảnh.

- **Cha có `opacity` nhỏ hơn 1 cũng khoá ngữ cảnh lại:**

  ```tsx
  {/* SAI — con không bao giờ ra khỏi được context này */}
  <div className="opacity-95">
    <div className="fixed inset-0 z-[60] bg-black/50" />
  </div>
  ```

---

## `ELEVATION-5` — viền gánh bậc thay bóng

`border border-border shadow-none`

### Trường hợp: khung tóm tắt nổi bên trong một thẻ đã nâng

```tsx
<section className="rounded-2xl bg-card p-4 shadow-surface">
  <h2 className="font-medium">Kết quả bài kiểm tra</h2>
  <div className="mt-3 rounded-xl border border-border p-3 shadow-none">
    <p className="text-sm">Bạn đúng 18 trên 20 câu và đã vượt qua mô-đun này.</p>
  </div>
</section>
```

Khối kết quả **thật sự** phải đọc là tách khỏi thẻ. Một cái bóng nữa ở đây sẽ là cái bóng thứ hai
trong cùng một mặt phẳng, nên viền gánh bậc thay.

### Trường hợp: khối cảnh báo trong một hộp thoại

```tsx
<div aria-modal="true" className="fixed inset-0 z-[60] grid place-items-center p-4" role="dialog">
  <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-dialog">
    <h2 className="font-medium">Huỷ đăng ký</h2>
    <div className="mt-3 rounded-xl border border-border p-3 shadow-none">
      <p className="text-sm">Bạn vẫn xem được nội dung đã tải cho tới hết kỳ thanh toán.</p>
    </div>
  </div>
</div>
```

### Trường hợp: thẻ lồng trên nền tối

```tsx
<section className="rounded-2xl bg-neutral-900 p-4">
  <article className="rounded-xl border border-white/10 p-3 shadow-none">
    <h3 className="text-sm font-medium text-white">Buổi phỏng vấn thử</h3>
    <p className="mt-1 text-xs text-white/60">Thứ Năm · 20:00</p>
  </article>
</section>
```

Bậc không đổi — article vẫn nằm trên phần nội dung. Chỉ phương tiện đổi, vì bóng đổ xuống nền tối là đổ vào
hư không.

### Trường hợp: vùng thả tệp đang chờ

```tsx
<div className="rounded-2xl bg-card p-4 shadow-surface">
  <div className="grid place-items-center rounded-xl border border-dashed border-border p-8 shadow-none">
    <p className="text-sm text-neutral-500">Kéo tệp vào đây hoặc bấm để chọn</p>
  </div>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Không vừa viền vừa bóng:**

  ```tsx
  {/* SAI */}  <div className="rounded-xl border border-border p-3 shadow-surface">…</div>
  ```

- **Viền không tự động là `ELEVATION-5`.** Nếu phần tử **không** cao hơn vật chủ, viền của nó là một
  tuyên bố quan hệ nhóm và mã độ nổi của nó là `ELEVATION-0`:

  ```tsx
  {/* ELEVATION-0, không phải ELEVATION-5 — các hàng ngang cấp, không hàng nào trên hàng nào */}
  <div className="rounded-2xl bg-card p-4 shadow-surface">
    <ul className="divide-y rounded-xl border border-border">
      <li className="p-3 text-sm">Nền tảng hệ thống</li>
      <li className="p-3 text-sm">Khả năng mở rộng</li>
    </ul>
  </div>
  ```

- **Đừng dùng `ELEVATION-5` để lách giới hạn một mức bóng nghỉ.** Thẻ thường và thẻ "nổi bật" trên
  cùng một nền vẫn là một bậc; đổi một trong hai sang viền chỉ là mã hoá thị hiếu bằng một mã khác.

---

## `ELEVATION-6` — khoét xuống thay vì xây lên

`inset-shadow-sm bg-muted`

### Trường hợp: máng tiến độ và thanh chạy trong máng

```tsx
<div className="h-2 rounded-full bg-muted inset-shadow-sm">
  <div className="h-2 w-3/5 rounded-full bg-neutral-900 shadow-surface" />
</div>
```

Máng là `ELEVATION-6`; thanh chạy là `ELEVATION-1` **đo từ đáy máng**. Chính khoảng chênh giữa hai
mã đó làm cho tiến độ đọc được mà không cần một con số nào.

### Trường hợp: rãnh của thanh trượt

```tsx
<div className="relative h-1.5 rounded-full bg-muted inset-shadow-sm">
  <div className="absolute inset-y-0 start-0 w-1/2 rounded-full bg-neutral-900" />
  <span className="absolute start-1/2 top-1/2 z-10 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-surface" />
</div>
```

Ba mã: rãnh `ELEVATION-6`, phần đã chạy `ELEVATION-0` (nó nằm **trong** rãnh, không nổi lên), núm kéo
`ELEVATION-1` cộng một thứ tự `ELEVATION-4` ở bậc `1` vì nó phủ lên phần đã chạy.

### Trường hợp: nhóm nút phân đoạn — máng chìm, viên trượt nổi

```tsx
<div className="inline-flex rounded-full bg-muted p-1 inset-shadow-sm" role="tablist">
  <button className="rounded-full bg-card px-4 py-1.5 text-sm shadow-surface" role="tab" type="button">Tháng</button>
  <button className="rounded-full px-4 py-1.5 text-sm" role="tab" type="button">Năm</button>
</div>
```

Thẻ tab đang chọn nổi lên khỏi máng; thẻ tab không chọn nằm trong lòng máng và không tuyên bố gì.

### Trường hợp: khối mã nằm chìm trong bài viết

```tsx
<article className="rounded-2xl bg-card p-6 shadow-surface">
  <p className="text-sm">Khoá ghi phải chạy trước khi phát sự kiện.</p>
  <pre className="mt-3 overflow-x-auto rounded-xl bg-muted p-4 text-sm inset-shadow-sm">
    <code>{snippet}</code>
  </pre>
</article>
```

### Ngoại lệ và nhầm lẫn

- **Đổi nền cho dễ nhìn không biến một khối thành cái giếng:**

  ```tsx
  {/* SAI — không có gì chảy trong đó, không có gì được đổ vào */}
  <div className="rounded-xl bg-muted p-4 inset-shadow-sm">
    <p className="text-sm">Khoá học này đã kết thúc.</p>
  </div>

  {/* ĐÚNG — ELEVATION-0, nền chỉ là màu */}
  <div className="rounded-xl bg-muted p-4">
    <p className="text-sm">Khoá học này đã kết thúc.</p>
  </div>
  ```

- **Không khoét xuống rồi lại nâng cả cụm lên:**

  ```tsx
  {/* SAI */}  <div className="h-2 rounded-full bg-muted shadow-surface inset-shadow-sm">…</div>
  ```

- **Ô nhập liệu vẽ như giếng thì con của nó không có bóng:**

  ```tsx
  <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 inset-shadow-sm">
    <svg aria-hidden="true" className="size-4" />
    <input aria-label="Tìm kiếm" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
  </div>
  ```

---

## Ánh xạ yêu cầu sang một chuỗi class CSS

Nêu nền cục bộ, phần tử và thứ nó che. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu cụ thể
rồi dừng. Câu trả lời phải là một chuỗi class CSS hoặc một câu hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Hiện mô tả ngắn dưới tiêu đề trong một thẻ | Nằm trong mặt phẳng của thẻ, không che ai | `ELEVATION-0` | không class CSS độ nổi |
| Dựng thẻ khoá học trên trang danh mục | Đối tượng độc lập đặt lên nền trang | `ELEVATION-1` | `shadow-surface` |
| Bấm ảnh đại diện thì xổ trình đơn tài khoản | Do người dùng gọi ra, bỏ qua không mất gì | `ELEVATION-2` | `z-30 shadow-popover` |
| Hỏi lại trước khi xoá, không cho làm gì khác | Trang phía sau ngừng dùng được | `ELEVATION-3` | `z-[60] shadow-dialog` + lớp nền mờ |
| Ghim thanh lọc ngay dưới thanh trên cùng | Chỉ cần thứ tự khi chồng lên nội dung | `ELEVATION-4` | `z-30` |
| Cho thanh tiến trình điều hướng vượt lên trên trên thanh | Bậc trên cùng của thang, không phải độ cao mới | `ELEVATION-4` | `z-[60]` |
| Đặt khối kết quả nổi bật bên trong một thẻ đã có bóng | Bậc thật, nhưng vật chủ đã dùng bóng | `ELEVATION-5` | `border border-border shadow-none` |
| Thẻ lồng trên chủ đề tối | Bậc thật, nhưng bóng không đọc được trên nền tối | `ELEVATION-5` | `border border-white/10 shadow-none` |
| Vẽ máng cho thanh tiến độ | Chỗ trũng để chứa thứ khác | `ELEVATION-6` | `bg-muted inset-shadow-sm` |
| Làm thẻ này nổi bật hơn các thẻ khác | Nhấn mạnh không phải độ cao ⇒ giữ bậc, đổi phương tiện nhấn | `ELEVATION-1` | `shadow-surface` + `ring-2` |
| Cho khung này nổi lên khi rê chuột | Con trỏ không làm phần tử che thêm gì ⇒ giữ nguyên bậc | `ELEVATION-1` | `shadow-surface` |
| Đặt một bảng trượt trượt lên từ đáy, phải chọn xong mới đóng | Chặn, dù hướng vào khác hộp thoại | `ELEVATION-3` | `z-[60] shadow-dialog` + lớp nền mờ |

Dòng "làm thẻ này nổi bật hơn" **chỉ** được hỏi lại khi bên yêu cầu nói rõ họ cần một tuyên bố về độ
cao: *"Thẻ này có thật sự nằm trên các thẻ kia không, hay chỉ cần thu hút chú ý trước?"*

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `ELEVATION-0` / `ELEVATION-1` | Nền ngay dưới nó là trang, hay là một bề mặt đã tuyên bố độ cao rồi? |
| `ELEVATION-1` / `ELEVATION-2` | Nó có sẵn khi trang hiển thị, hay do một hành động của người dùng gọi ra? |
| `ELEVATION-2` / `ELEVATION-3` | Bỏ qua nó thì có mất gì không? |
| `ELEVATION-3` / `ELEVATION-4` | Nó có đang hỏi một câu phải trả lời, hay chỉ đang chiếm chỗ? |
| `ELEVATION-4` / mọi mã có bóng | Ta cần một thứ tự, hay một độ cao? |
| `ELEVATION-1` / `ELEVATION-5` | Bóng ở đây có nói được gì mà mắt đọc ra không? |
| `ELEVATION-0` / `ELEVATION-5` | Phần tử có thật sự nằm **trên** vật chủ, hay chỉ đang khoanh vùng thành viên? |
| `ELEVATION-0` / `ELEVATION-6` | Có thứ gì chảy, trượt hoặc được đổ vào bên trong nó không? |

## Sai lầm lặp lại nhiều nhất

1. Chồng bóng nghỉ lên bóng nghỉ — thẻ trong thẻ cùng một `shadow-surface`.
2. Leo số `z` để thắng một cuộc tranh chấp mà nguyên nhân là ngữ cảnh xếp chồng hoặc thứ tự nguồn.
3. Đặt một số ở giữa hai bậc (`z-[45]`), hoặc nhảy thẳng lên `z-[9999]` "cho chắc".
4. Mở lớp thứ hai ở cấp phần thân từ bên trong một lớp đang mở, thay vì hiển thị lồng vào.
5. Dùng bóng làm hiệu ứng rê chuột, biến thang độ cao thành thang phản hồi.
6. Đẻ thêm mức bóng nghỉ thứ hai để diễn đạt "nổi bật hơn".
7. Lớp được gọi ra mà nền trong suốt, để chữ chồng lên chữ.
8. Viết `shadow-none` hoặc `z-0` ở nơi chưa từng có tuyên bố nào.
9. Vừa `border` vừa `shadow-surface` trên cùng một phần tử.
10. Đổi bậc giữa khung chờ và nội dung thật.
