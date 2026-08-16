---
id: fe-principles-state-example
title: example.md
slug: /gates/principles/state/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp và ngoại lệ của từng mã STATE-N, viết bằng className thuần.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `state` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **mã đánh dấu thường với `className` thường**. Không thư viện thành phần, không thiết kế
hệ thống riêng, không khoá đăng ký. Một luật chỉ đúng khi nó đúng ở bất kỳ giao diện nào — nên nếu một
ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó sai chỗ.

Mỗi mã có **nhiều trường hợp**, rồi tới **ngoại lệ** và **những thứ trông giống nhưng không phải mã đó**.
Phần cuối trang ánh xạ từ yêu cầu bằng lời sang tập lớp trạng thái mà phần tử phải trả đủ.

Trong cả trang này, các class CSS màu là **tên vai trò** (`bg-muted`, `ring-ring`, `border-danger`), vì
mô-đun này quyết **lớp nào tồn tại**, không quyết **màu nào được dùng**. Màu là câu hỏi của mô-đun
hàng xóm.

---

## `STATE-0` — không có trục trạng thái nào

### Trường hợp: đoạn mô tả

```tsx
<p className="text-sm text-muted-foreground">
  Bài học mở khoá sau khi bạn hoàn thành chương trước.
</p>
```

### Trường hợp: một ô số liệu chỉ để đọc

```tsx
<div className="rounded-lg border border-border bg-card p-4">
  <span className="block text-2xl font-semibold tabular-nums text-foreground">86</span>
  <span className="block text-sm text-muted-foreground">bài đã hoàn thành</span>
</div>
```

Thẻ này **không** nhận `hover:shadow-md`. Không có gì xảy ra khi bấm vào nó, nên nó không có trục
trạng thái nào để mở.

### Trường hợp: biểu tượng trang trí và nhãn trạng thái phân loại tĩnh

```tsx
<span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
  <svg aria-hidden="true" className="size-3" />
  Nền tảng
</span>
```

### Ngoại lệ và nhầm lẫn

- **Thẻ vẽ rê chuột là thẻ đã tự khai mình bấm được.** Đã mở trục trạng thái thì phải trả đủ, và phải
  thật sự bấm được bằng bàn phím:

  ```tsx
  {/* SAI — trông bấm được, không tab tới được, không có focus */}
  <div className="rounded-lg border border-border p-4 hover:shadow-md" onClick={open}>
    Thiết kế hệ thống phân tán
  </div>

  {/* ĐÚNG — nếu bấm được thì nó là control, và trả đủ bốn lớp */}
  <button
    className="w-full rounded-lg border border-border p-4 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:bg-muted/80"
    onClick={open}
    type="button"
  >
    Thiết kế hệ thống phân tán
  </button>
  ```

- **Đừng viết biến thể rỗng để "cho có".** `hover:bg-transparent` trên một đoạn văn là nói dối rằng nó
  thao tác được:

  ```tsx
  {/* SAI */}  <p className="text-sm hover:bg-transparent">Bài học tiếp theo</p>
  {/* ĐÚNG */} <p className="text-sm text-muted-foreground">Bài học tiếp theo</p>
  ```

- **Một dòng danh sách chọn được không phải `STATE-0`,** dù lúc chụp màn hình nó chưa được chọn.
  Nó là `STATE-1` + `STATE-2` + `STATE-3` + `STATE-4` + `STATE-6`.

---

## `STATE-1` — trạng thái nghỉ, gốc của mọi lớp khác

### Trường hợp: nút chính, lớp nghỉ giữ toàn bộ hình học

```tsx
<button
  className="inline-flex h-10 items-center rounded-md border border-transparent bg-primary px-4 text-sm font-medium text-primary-foreground"
  type="submit"
>
  Lưu thay đổi
</button>
```

Chiều cao, viền, khoảng đệm trong, cân nặng chữ đều nằm ở đây. Các lớp sau chỉ được đổi màu, bóng và vòng.

### Trường hợp: ô nhập ở trạng thái nghỉ

```tsx
<input
  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
  id="email"
  placeholder="ban@vidu.com"
  type="email"
/>
```

### Trường hợp: liên kết trong câu văn

```tsx
<p className="text-sm text-foreground">
  Xem thêm ở{" "}
  <a className="font-medium text-primary underline underline-offset-4" href="/huong-dan">
    hướng dẫn bắt đầu
  </a>
  .
</p>
```

Chưa đủ. Xem `STATE-3` — liên kết này còn thiếu lớp bắt buộc, và đó là lỗi hay gặp nhất của cả mô-đun.

### Ngoại lệ và nhầm lẫn

- **Nền chỉ đặt ở `hover:` là làm ngược.** Trên thiết bị cảm ứng con trỏ không rời đi, nên phần tử
  **kẹt sáng** sau cú chạm:

  ```tsx
  {/* SAI — không có lớp nghỉ, chỉ có lớp hover */}
  <button className="rounded-md px-3 py-2 hover:bg-muted" type="button">Lọc</button>

  {/* ĐÚNG — lớp nghỉ có thật, hover chồng lên nó */}
  <button
    className="rounded-md border border-border bg-background px-3 py-2 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:bg-muted/80"
    type="button"
  >
    Lọc
  </button>
  ```

- **Đừng đẩy hình học sang lớp khác.** Viền chỉ xuất hiện khi rê chuột thì phần tử **to ra 2px** lúc rê
  chuột và mọi thứ bên cạnh dịch chỗ:

  ```tsx
  {/* SAI */}  <button className="px-3 py-2 hover:border">Lưu</button>
  {/* ĐÚNG */} <button className="border border-transparent px-3 py-2 hover:border-border">Lưu</button>
  ```

---

## `STATE-2` — con trỏ đang nằm trên phần tử

### Trường hợp: nút thứ cấp

```tsx
<button
  className="h-10 rounded-md border border-border bg-background px-4 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:bg-muted/80"
  type="button"
>
  Xem trước
</button>
```

### Trường hợp: dòng danh sách bấm được

```tsx
<li>
  <button
    className="flex w-full items-center justify-between rounded-md p-3 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:bg-muted/80"
    type="button"
  >
    <span className="text-sm text-foreground">Quorum đọc và ghi</span>
    <span className="text-xs text-muted-foreground">12 phút</span>
  </button>
</li>
```

### Trường hợp: nút chỉ có biểu tượng — vẫn đủ bốn lớp, và vẫn có tên

```tsx
<button
  aria-label="Xoá bộ lọc"
  className="grid size-9 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:bg-muted/80"
  type="button"
>
  <svg aria-hidden="true" className="size-4" />
</button>
```

### Trường hợp: rê chuột đổi màu nền, không đổi kích thước

```tsx
<a
  className="block rounded-md border border-border bg-card p-4 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:bg-muted/80"
  href="/khoa-hoc/he-thong-phan-tan"
>
  <span className="block font-medium text-foreground">Thiết kế hệ thống phân tán</span>
  <span className="block text-sm text-muted-foreground">20 bài · 8 giờ</span>
</a>
```

`transition-colors` chứ không `transition-all`: chuyển động chỉ được phép chạy trên những thuộc tính
không tính lại bố cục.

### Ngoại lệ và nhầm lẫn

- **Rê chuột một mình là lỗi nặng nhất của mô-đun này.** Nó trông hoàn chỉnh trong ảnh chụp:

  ```tsx
  {/* SAI — chuột dùng được, bàn phím thì không */}
  <a className="rounded-md px-3 py-2 hover:bg-muted" href="/cai-dat">Cài đặt</a>

  {/* ĐÚNG */}
  <a
    className="rounded-md px-3 py-2 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    href="/cai-dat"
  >
    Cài đặt
  </a>
  ```

- **Thông tin chỉ hiện khi rê chuột thì trên điện thoại nó không tồn tại.** Nút xoá của một dòng phải
  luôn có mặt, hoặc phải có một đường vào khác:

  ```tsx
  {/* SAI — trên cảm ứng không bao giờ chạm tới được */}
  <li className="group flex items-center justify-between p-3">
    <span>bao-cao-quy-4.pdf</span>
    <button className="hidden group-hover:block" type="button">Xoá</button>
  </li>

  {/* ĐÚNG — luôn có mặt, chỉ nhạt đi khi nghỉ */}
  <li className="group flex items-center justify-between p-3">
    <span className="text-sm text-foreground">bao-cao-quy-4.pdf</span>
    <button
      aria-label="Xoá bao-cao-quy-4.pdf"
      className="rounded-md p-2 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring group-hover:text-foreground active:bg-muted/80"
      type="button"
    >
      <svg aria-hidden="true" className="size-4" />
    </button>
  </li>
  ```

---

## `STATE-3` — bàn phím vừa rơi vào phần tử

### Trường hợp: liên kết trong câu văn, trả đủ lớp

```tsx
<a
  className="rounded-sm font-medium text-primary underline underline-offset-4 outline-none hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  href="/huong-dan"
>
  hướng dẫn bắt đầu
</a>
```

### Trường hợp: hộp kiểm và nhãn của nó

```tsx
<label className="flex items-start gap-2 text-sm text-foreground">
  <input
    className="mt-0.5 size-4 rounded border-border outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    type="checkbox"
  />
  <span>Tôi đồng ý với điều khoản dịch vụ</span>
</label>
```

### Trường hợp: dòng trình đơn, vòng nằm trong (`ring-inset`) vì dòng chạm mép khung

```tsx
<div className="rounded-lg border border-border bg-card p-1" role="menu">
  <button
    className="w-full rounded-md px-3 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:bg-muted/80"
    role="menuitem"
    type="button"
  >
    Đổi mật khẩu
  </button>
  <button
    className="w-full rounded-md px-3 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:bg-muted/80"
    role="menuitem"
    type="button"
  >
    Đăng xuất
  </button>
</div>
```

### Trường hợp: bỏ qua liên kết — chỉ nhìn thấy khi tiêu điểm, và đó là toàn bộ lý do nó tồn tại

```tsx
<a
  className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-card focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:ring-2 focus-visible:ring-ring"
  href="#noi-dung"
>
  Bỏ qua điều hướng
</a>
```

### Ngoại lệ và nhầm lẫn

- **`outline-none` một mình là xoá lớp, không phải sửa lớp:**

  ```tsx
  {/* SAI */}  <button className="rounded-md px-3 py-2 outline-none" type="button">Lưu</button>
  {/* ĐÚNG */} <button className="rounded-md px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring" type="button">Lưu</button>
  ```

- **`focus:` không phải `focus-visible:`.** Dùng `focus:` thì vòng dính lại sau mỗi cú bấm chuột,
  trông như lỗi, và rồi sẽ có người xoá hẳn nó đi — đó chính là con đường lớp này biến mất:

  ```tsx
  {/* SAI */}  <button className="focus:ring-2 focus:ring-ring" type="button">Lưu</button>
  {/* ĐÚNG */} <button className="outline-none focus-visible:ring-2 focus-visible:ring-ring" type="button">Lưu</button>
  ```

- **Vòng phải nhìn thấy trên nền nó đang nằm.** Cùng một class CSS trên hai nền cho hai kết quả khác
  nhau; trên nền tối thì vòng cần `ring-offset` đúng màu nền để không bị nuốt:

  ```tsx
  <div className="rounded-lg bg-card p-4">
    <button
      className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
      type="button"
    >
      Ghi danh
    </button>
  </div>
  ```

- **`tabIndex={-1}` không miễn `STATE-3`.** Nó chỉ nói phần tử không nằm trong luồng Thẻ tab; nếu mã
  vẫn `focus()` vào nó — như tiêu đề hộp thoại khi mở — thì lớp tiêu điểm vẫn phải có thật.

---

## `STATE-4` — cú nhấn đang diễn ra

### Trường hợp: nút cam kết một hành động

```tsx
<button
  className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:bg-primary/80"
  type="submit"
>
  Thanh toán
</button>
```

Ba lớp tạm thời khai báo đúng theo thứ tự chỉ số: `hover:` → `focus-visible:` → `active:`. Cùng độ
đặc hiệu thì cái viết sau thắng, nên cú nhấn đè được lên rê chuột.

### Trường hợp: `scale` là cách đổi hình dạng mà không tính lại bố cục

```tsx
<button
  className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground outline-none transition-transform hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95"
  type="button"
>
  <svg aria-hidden="true" className="size-5" />
</button>
```

`scale` chạy ở bước vẽ, không ở bước tính bố cục, nên nó không đẩy hàng xóm.

### Trường hợp: phím tăng giảm số lượng — nơi `STATE-4` là phản hồi duy nhất trên cảm ứng

```tsx
<div className="inline-flex items-center rounded-md border border-border">
  <button
    aria-label="Giảm số lượng"
    className="size-10 rounded-l-md text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:bg-muted/80"
    type="button"
  >
    −
  </button>
  <span className="w-12 text-center text-sm tabular-nums text-foreground">2</span>
  <button
    aria-label="Tăng số lượng"
    className="size-10 rounded-r-md text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:bg-muted/80"
    type="button"
  >
    +
  </button>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Đừng đổi hình học khi nhấn.** Thành phần điều khiển dịch chuyển dưới ngón tay thì cú nhấn thứ hai rơi ra ngoài:

  ```tsx
  {/* SAI — chữ dày lên, nút rộng ra, hàng xóm dịch chỗ */}
  <button className="px-4 py-2 active:font-bold" type="button">Lưu</button>

  {/* ĐÚNG */}
  <button className="px-4 py-2 font-medium active:bg-muted/80" type="button">Lưu</button>
  ```

- **`active:` khai báo trước `hover:` thì rê chuột thắng và cú nhấn không hiện ra:**

  ```tsx
  {/* SAI */}  <button className="active:bg-muted/80 hover:bg-muted" type="button">Lưu</button>
  {/* ĐÚNG */} <button className="hover:bg-muted active:bg-muted/80" type="button">Lưu</button>
  ```

- **`STATE-4` không thay được `STATE-7`.** Cú nhấn nhả ra là lớp này tắt; nếu kết quả chưa về mà
  không có gì thay thế, người dùng sẽ bấm lần hai.

---

## `STATE-5` — không dùng được trong ngữ cảnh này

### Trường hợp: nút gửi khi biểu mẫu chưa hợp lệ

```tsx
<button
  className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:bg-primary/80 disabled:pointer-events-none disabled:opacity-50"
  disabled={!isValid}
  type="submit"
>
  Tạo tài khoản
</button>
```

`disabled:pointer-events-none` là thứ dập tắt `STATE-2` và `STATE-4`. Không có nó, nút xám vẫn sáng
lên khi rê chuột, tức là vẫn đang hứa rằng một cú bấm sẽ ăn.

### Trường hợp: nút phân trang ở đầu danh sách

```tsx
<nav className="flex items-center gap-2">
  <button
    className="h-9 rounded-md border border-border px-3 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:bg-muted/80 disabled:pointer-events-none disabled:opacity-50"
    disabled={page === 1}
    type="button"
  >
    Trang trước
  </button>
  <span className="text-sm tabular-nums text-muted-foreground">{page} / {total}</span>
  <button
    className="h-9 rounded-md border border-border px-3 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:bg-muted/80 disabled:pointer-events-none disabled:opacity-50"
    disabled={page === total}
    type="button"
  >
    Trang sau
  </button>
</nav>
```

### Trường hợp: ngoại lệ "tắt nhưng phải giải thích được"

```tsx
<div className="flex flex-col gap-1">
  <button
    aria-describedby="ly-do-khoa"
    aria-disabled="true"
    className="h-10 rounded-md border border-border px-4 text-sm outline-none opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    onClick={(event) => event.preventDefault()}
    type="button"
  >
    Xuất chứng chỉ
  </button>
  <p className="text-xs text-muted-foreground" id="ly-do-khoa">
    Cần hoàn thành 100% bài học để xuất chứng chỉ.
  </p>
</div>
```

Không có `disabled`, nên phần tử vẫn đến được bằng phím Thẻ tab và lời giải thích vẫn đọc được. Không có `hover:`
và `active:`, vì không có gì để hứa. `focus-visible:` vẫn giữ — nó vẫn nằm trong thẻ tab thứ tự.

### Ngoại lệ và nhầm lẫn

- **`disabled` + `cursor-not-allowed` không hoạt động như người ta tưởng.** Trình duyệt không phát
  sự kiện con trỏ trên thành phần điều khiển đã `disabled`, nên con trỏ khai trên chính nó không đáng tin. Muốn
  con trỏ nói được, đặt nó lên phần tử bọc ngoài:

  ```tsx
  <span className="inline-block cursor-not-allowed">
    <button className="pointer-events-none opacity-50" disabled type="button">Xuất dữ liệu</button>
  </span>
  ```

- **Đừng dùng `STATE-5` để nói "không sửa ở đây".** Đó là `STATE-9`:

  ```tsx
  {/* SAI — giá trị mờ đi, không copy được, không tab tới được */}
  <input className="opacity-50" disabled value="DH-2026-004182" />

  {/* ĐÚNG */}
  <input
    className="h-10 w-full rounded-md border border-border bg-muted px-3 text-sm text-foreground outline-none read-only:cursor-default focus-visible:ring-2 focus-visible:ring-ring"
    readOnly
    value="DH-2026-004182"
  />
  ```

- **Đừng tắt một trường nhập liệu đang lỗi.** Đó là khoá người dùng ra khỏi đúng thứ họ cần sửa.

---

## `STATE-6` — đang được chọn, đang mở, đang đứng ở đây

### Trường hợp: điều hướng — trang hiện tại

```tsx
<nav className="flex flex-col gap-1">
  <a
    aria-current="page"
    className="rounded-md px-3 py-2 text-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:bg-muted/80 aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
    href="/bang-dieu-khien"
  >
    Bảng điều khiển
  </a>
  <a
    className="rounded-md px-3 py-2 text-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:bg-muted/80 aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
    href="/khoa-hoc"
  >
    Khoá học
  </a>
</nav>
```

### Trường hợp: thẻ tab — dấu hiệu thứ hai là một thanh chỉ báo, không chỉ là màu

```tsx
<div className="flex gap-1 border-b border-border" role="tablist">
  <button
    aria-selected="true"
    className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring aria-selected:border-primary aria-selected:text-foreground"
    role="tab"
    type="button"
  >
    Tổng quan
  </button>
  <button
    aria-selected="false"
    className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring aria-selected:border-primary aria-selected:text-foreground"
    role="tab"
    type="button"
  >
    Hoạt động
  </button>
</div>
```

Viền `border-b-2 border-transparent` có mặt ở `STATE-1`. Nếu chỉ thêm viền khi được chọn, thẻ tab sẽ
**cao thêm 2px** lúc chuyển và cả hàng nhảy.

### Trường hợp: nút bật/tắt bộ lọc — dấu hiệu thứ hai là một dấu vạch chia

```tsx
<button
  aria-pressed={isOn}
  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:bg-muted/80 aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary"
  type="button"
>
  {isOn ? <svg aria-hidden="true" className="size-3" /> : null}
  Đang học
</button>
```

### Trường hợp: vùng thu gọn đang mở

```tsx
<button
  aria-expanded={isOpen}
  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:bg-muted/80 aria-expanded:bg-muted"
  type="button"
>
  <span>Chính sách hoàn tiền</span>
  <svg aria-hidden="true" className="size-4 transition-transform aria-expanded:rotate-180" />
</button>
```

### Ngoại lệ và nhầm lẫn

- **Chọn và rê chuột không được dùng cùng một màu nền.** Nếu trùng, người dùng không phân biệt được cái
  mình đang trỏ với cái đang được chọn:

  ```tsx
  {/* SAI — hover và selected cùng là bg-muted */}
  <a className="hover:bg-muted aria-[current=page]:bg-muted" href="/khoa-hoc">Khoá học</a>

  {/* ĐÚNG — selected có thêm một dấu hiệu riêng */}
  <a
    className="border-l-2 border-transparent hover:bg-muted aria-[current=page]:border-primary aria-[current=page]:bg-muted aria-[current=page]:font-medium"
    href="/khoa-hoc"
  >
    Khoá học
  </a>
  ```

  Ở bản đúng, `font-medium` chỉ an toàn vì nhãn nằm trong một cột có bề rộng cố định. Trong một hàng
  ngang co theo nội dung thì nó đẩy hàng xóm và bị luật cấm — lúc đó chỉ giữ viền trái.

- **CSS không có `aria-*` thì trình đọc màn hình không thấy gì:**

  ```tsx
  {/* SAI — mắt thấy, tai không nghe */}
  <a className={isCurrent ? "bg-muted font-medium" : ""} href="/khoa-hoc">Khoá học</a>
  ```

- **`STATE-6` không thay được `STATE-1`.** Mục chưa được chọn vẫn là một thành phần điều khiển đủ bốn lớp, không
  phải một bản mờ của mục đang chọn.

---

## `STATE-7` — việc của chính phần tử đang chạy dở

### Trường hợp: nút gửi biểu mẫu đang chờ máy chủ

```tsx
<button
  aria-busy={isSubmitting}
  className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:bg-primary/80 disabled:pointer-events-none aria-busy:cursor-progress"
  disabled={isSubmitting}
  type="submit"
>
  {isSubmitting ? <svg aria-hidden="true" className="size-4 animate-spin" /> : null}
  Gửi bài nộp
</button>
```

Chữ **không đổi**. Thay "Gửi bài nộp" bằng "Đang gửi…" làm nút co giãn và cả hàng nút dịch chỗ giữa
lúc người dùng đang nhìn vào đó.

### Trường hợp: giữ sẵn chỗ cho chỉ báo, để không nhảy một điểm ảnh nào

```tsx
<button
  aria-busy={isSaving}
  className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:bg-muted/80 disabled:pointer-events-none"
  disabled={isSaving}
  type="button"
>
  <span aria-hidden="true" className="size-4 shrink-0">
    {isSaving ? <svg className="size-4 animate-spin" /> : null}
  </span>
  Lưu nháp
</button>
```

### Trường hợp: ngoại lệ "bận ở cấp vùng" — vùng mang `STATE-7`, thành phần điều khiển bên trong mang `STATE-5`

```tsx
<section aria-busy={isReloading} className="rounded-lg border border-border p-4">
  <div className="flex items-center justify-between">
    <h2 className="text-sm font-medium text-foreground">Giao dịch gần đây</h2>
    <button
      className="h-9 rounded-md border border-border px-3 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:bg-muted/80 disabled:pointer-events-none disabled:opacity-50"
      disabled={isReloading}
      type="button"
    >
      Tải lại
    </button>
  </div>
  <div className="mt-3" role="status">
    {isReloading ? <span className="text-sm text-muted-foreground">Đang tải lại…</span> : null}
  </div>
</section>
```

Công việc thuộc về vùng, nên vùng khai `aria-busy`. Nút chỉ là thứ khởi động nó, nên nút khai
`STATE-5`. Hai phần tử **không cùng nhận** một công việc đang chạy.

### Ngoại lệ và nhầm lẫn

- **Vẽ biểu tượng đang tải mà không chặn cú bấm thứ hai là vẽ cho đẹp:**

  ```tsx
  {/* SAI — vẫn bấm được, vẫn tạo hai đơn hàng */}
  <button className="inline-flex items-center gap-2" type="submit">
    {isSubmitting ? <svg className="size-4 animate-spin" /> : null}
    Đặt hàng
  </button>
  ```

- **Đừng thay nội dung bằng biểu tượng đang tải rồi để nút co lại:**

  ```tsx
  {/* SAI — nút từ 120px xuống 40px, cả hàng nút nhảy */}
  <button type="submit">{isSubmitting ? <svg className="size-4 animate-spin" /> : "Đặt hàng"}</button>
  ```

- **`STATE-7` không phải nội dung đang tải lần đầu.** Một vùng chưa có dữ liệu để vẽ là chuyện của
  nội dung vùng đó, không phải lớp trạng thái của một phần tử.

---

## `STATE-8` — giá trị đang giữ đã bị từ chối

### Trường hợp: một trường nhập liệu và thông báo được liên kết

```tsx
<div className="flex flex-col gap-1">
  <label className="text-sm font-medium text-foreground" htmlFor="email">Email</label>
  <input
    aria-describedby="email-loi"
    aria-invalid={Boolean(error)}
    className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-danger aria-invalid:ring-1 aria-invalid:ring-danger"
    id="email"
    type="email"
  />
  <p className="min-h-4 text-xs text-danger" id="email-loi">
    {error}
  </p>
</div>
```

`min-h-4` giữ sẵn chỗ cho thông báo. Không có nó, mọi thứ bên dưới tụt xuống đúng lúc người dùng
đang nhắm bấm nút gửi.

### Trường hợp: viền đỏ không đủ — phải có chữ, và chữ phải có biểu tượng đi kèm

```tsx
<div className="flex flex-col gap-1">
  <label className="text-sm font-medium text-foreground" htmlFor="ma-giam-gia">Mã giảm giá</label>
  <input
    aria-describedby="ma-loi"
    aria-invalid="true"
    className="h-10 rounded-md border border-danger bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
    id="ma-giam-gia"
    defaultValue="SALE2020"
  />
  <p className="flex items-center gap-1 text-xs text-danger" id="ma-loi">
    <svg aria-hidden="true" className="size-3 shrink-0" />
    Mã này đã hết hạn.
  </p>
</div>
```

### Trường hợp: vừa có tiêu điểm vừa không hợp lệ — giữ cả hai lớp

```tsx
<input
  aria-invalid="true"
  className="h-10 w-full rounded-md border border-danger bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  defaultValue="0912"
  id="dien-thoai"
/>
```

Vòng tiêu điểm nằm **ngoài** nhờ `ring-offset-2`, viền lỗi vẫn nhìn thấy nguyên vẹn bên trong. Vòng không
được nuốt viền lỗi.

### Ngoại lệ và nhầm lẫn

- **Biểu ngữ đầu biểu mẫu không thay được lớp trên từng trường nhập liệu:**

  ```tsx
  {/* SAI — người dùng biết "có lỗi", không biết "lỗi ở đâu" */}
  <form>
    <p className="rounded-md border border-danger p-3 text-sm text-danger">Vui lòng kiểm tra lại.</p>
    <input className="h-10 rounded-md border border-border px-3" id="email" />
  </form>
  ```

- **Đừng tắt trường nhập liệu lỗi, và đừng xoá giá trị sai đi.** Người dùng cần thấy mình đã nhập gì để sửa:

  ```tsx
  {/* SAI */}  <input aria-invalid="true" disabled value="" />
  ```

---

## `STATE-9` — giá trị đọc được nhưng bị đóng băng

### Trường hợp: mã đơn hàng do hệ thống sinh

```tsx
<div className="flex flex-col gap-1">
  <label className="text-sm font-medium text-foreground" htmlFor="ma-don">Mã đơn hàng</label>
  <input
    className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none read-only:bg-muted read-only:cursor-default focus-visible:ring-2 focus-visible:ring-ring"
    id="ma-don"
    readOnly
    value="DH-2026-004182"
  />
</div>
```

Vẫn đến được bằng phím Thẻ tab, vẫn bôi đen văn bản được, vẫn có `STATE-3`. Đó là toàn bộ khác biệt với `STATE-5`.

### Trường hợp: thư điện tử đã xác thực — sửa ở chỗ khác, không sửa ở đây

```tsx
<div className="flex flex-col gap-1">
  <label className="text-sm font-medium text-foreground" htmlFor="email-ho-so">Email</label>
  <input
    aria-describedby="email-ghi-chu"
    className="h-10 rounded-md border border-border px-3 text-sm outline-none read-only:bg-muted read-only:cursor-default focus-visible:ring-2 focus-visible:ring-ring"
    id="email-ho-so"
    readOnly
    value="an.nguyen@vidu.com"
  />
  <p className="text-xs text-muted-foreground" id="email-ghi-chu">
    Đổi email trong phần Bảo mật.
  </p>
</div>
```

### Trường hợp: khoá tạm thời trong lúc gửi — `STATE-9` và `STATE-7` cùng có mặt

```tsx
<input
  aria-busy={isSubmitting}
  className="h-10 w-full rounded-md border border-border px-3 text-sm outline-none read-only:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-busy:cursor-progress"
  id="tieu-de"
  readOnly={isSubmitting}
/>
```

Dùng `readOnly` chứ không `disabled`: giá trị vẫn được gửi kèm khi gửi, và ô không biến mất khỏi
thẻ tab thứ tự giữa chừng làm tiêu điểm của người dùng rơi về đầu trang.

### Ngoại lệ và nhầm lẫn

- **Nếu giá trị chỉ để đọc và không phải một trường nhập liệu, đừng hiển thị một `<input>`:**

  ```tsx
  {/* SAI — giả làm ô nhập, gây hiểu nhầm là sửa được */}
  <input className="border" readOnly value="4.9 / 5" />

  {/* ĐÚNG — STATE-0, trung thực hơn */}
  <p className="text-sm text-foreground">4,9 / 5</p>
  ```

- **`readOnly` không có tác dụng trên hộp kiểm, nút chọn và ô chọn.** Với chúng, hoặc dùng `STATE-5`,
  hoặc hiển thị giá trị dưới dạng chữ.

---

## Mã lồng mã

Một mã áp cho **một phần tử**, không áp cho cả cây. Dòng bên ngoài và thành phần điều khiển bên trong có tập lớp
riêng, và chúng không nhắc lại lẫn nhau.

### Trường hợp: dòng đang được chọn, chứa một nút bị tắt

```tsx
<li>
  <div
    aria-selected={isSelected}
    className="flex items-center justify-between rounded-md border-l-2 border-transparent p-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:bg-muted/80 aria-selected:border-primary aria-selected:bg-muted"
    role="option"
    tabIndex={0}
  >
    <span className="text-sm text-foreground">Bản nháp: Bài 4 — Idempotency</span>
    <button
      className="rounded-md px-2 py-1 text-xs outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring active:bg-background/80 disabled:pointer-events-none disabled:opacity-50"
      disabled={!canPublish}
      type="button"
    >
      Xuất bản
    </button>
  </div>
</li>
```

Dòng ngoài: `STATE-1` + `STATE-2` + `STATE-3` + `STATE-4` + `STATE-6`. Nút trong: `STATE-1` +
`STATE-2` + `STATE-3` + `STATE-4` + `STATE-5`. Nút **không** nhắc lại trạng thái chọn của dòng — theo
ngoại lệ *chọn do tổ tiên sở hữu*.

### Trường hợp: một khối biểu mẫu đủ bốn mã khai báo cùng lúc

```tsx
<form className="flex flex-col gap-4">
  <div className="flex flex-col gap-1">
    <label className="text-sm font-medium text-foreground" htmlFor="slug">Đường dẫn</label>
    <input
      className="h-10 rounded-md border border-border px-3 text-sm outline-none read-only:bg-muted read-only:cursor-default focus-visible:ring-2 focus-visible:ring-ring"
      id="slug"
      readOnly
      value="he-thong-phan-tan"
    />
  </div>

  <div className="flex flex-col gap-1">
    <label className="text-sm font-medium text-foreground" htmlFor="ten">Tiêu đề</label>
    <input
      aria-describedby="ten-loi"
      aria-invalid={Boolean(titleError)}
      className="h-10 rounded-md border border-border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-danger aria-invalid:ring-1 aria-invalid:ring-danger"
      id="ten"
    />
    <p className="min-h-4 text-xs text-danger" id="ten-loi">{titleError}</p>
  </div>

  <button
    aria-busy={isSubmitting}
    className="inline-flex h-10 items-center gap-2 self-start rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:bg-primary/80 disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress"
    disabled={isSubmitting || Boolean(titleError)}
    type="submit"
  >
    <span aria-hidden="true" className="size-4 shrink-0">
      {isSubmitting ? <svg className="size-4 animate-spin" /> : null}
    </span>
    Lưu khoá học
  </button>
</form>
```

Ba phần tử, ba tập lớp khác nhau, và không phần tử nào mượn lớp của phần tử khác:

| Phần tử | Tập mã |
|---|---|
| Ô đường dẫn | `STATE-1` `STATE-3` `STATE-9` |
| Ô tiêu đề | `STATE-1` `STATE-3` `STATE-8` |
| Nút lưu | `STATE-1` `STATE-2` `STATE-3` `STATE-4` `STATE-5` `STATE-7` |

Ô đường dẫn **không** có `STATE-2` và `STATE-4`: nó không phải thứ được nhấn để cam kết một hành
động, và rê chuột trên một trường nhập liệu chỉ đọc không hứa điều gì.

---

## Ánh xạ yêu cầu sang tập lớp trạng thái

Nêu phần tử và năng lực của nó. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu cụ thể rồi
dừng. Câu trả lời phải là một tập mã hoặc một câu hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Hiện một đoạn mô tả dưới tiêu đề | Không gì tác động được vào nó | `STATE-0` | không biến thể |
| Làm nút thứ cấp cho thao tác Xem trước | Bấm được ⇒ đủ sàn bốn lớp | `STATE-1` `STATE-2` `STATE-3` `STATE-4` | `hover:bg-muted focus-visible:ring-2 active:bg-muted/80` |
| Làm thẻ khoá học bấm vào để mở chi tiết | Thẻ bấm được là một thành phần điều khiển | `STATE-1` `STATE-2` `STATE-3` `STATE-4` | như trên, trên `<a>` hoặc `<button>` |
| Khoá nút gửi cho tới khi biểu mẫu hợp lệ | Điều kiện nghiệp vụ bật/tắt phần tử | thêm `STATE-5` | `disabled:pointer-events-none disabled:opacity-50` |
| Khoá nút, và nói rõ vì sao khoá | Lý do phải đọc được ⇒ giữ trong thẻ tab thứ tự | `STATE-5` (ngoại lệ) | `aria-disabled` + `aria-describedby` |
| Đánh dấu mục điều hướng của trang đang mở | Trạng thái bền, do dữ liệu quyết | thêm `STATE-6` | `aria-current="page"` + `aria-[current=page]:*` |
| Nút thanh toán, đừng để bấm hai lần | Việc chạy qua mạng | thêm `STATE-7` | `aria-busy` + `disabled` + chỉ báo giữ chỗ |
| Báo thư điện tử sai định dạng ngay tại ô nhập | Giá trị bị bộ kiểm tra từ chối | thêm `STATE-8` | `aria-invalid` + `aria-describedby` + `min-h-*` |
| Hiện mã đơn hàng, không cho sửa, cho sao chép | đọc và sao chép được ⇒ không phải tắt | `STATE-1` `STATE-3` `STATE-9` | `readOnly` + `read-only:bg-muted` |
| Làm dòng danh sách bấm được, có thể đang được chọn | Bấm được **và** có trạng thái bền | `STATE-1`…`STATE-4` + `STATE-6` | sàn bốn lớp + `aria-selected:*` |

Ở dòng thứ năm, câu hỏi phân định **chỉ** được hỏi khi yêu cầu chưa nói rõ: *"Người dùng có cần biết
lý do phần tử bị khoá không?"*

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `STATE-0` / `STATE-1` | Có thứ gì — con trỏ, bàn phím, dữ liệu — làm phần tử này đổi hình dạng không? |
| `STATE-1` / `STATE-2` | Đây là hình dạng nó quay về, hay hình dạng tạm thời chồng lên? |
| `STATE-2` / `STATE-3` | Rút chuột ra thì lớp này còn nhìn thấy được không? |
| `STATE-2` / `STATE-6` | Buông con trỏ và tải lại trang, trạng thái này còn không? |
| `STATE-4` / `STATE-7` | Lớp này dài bằng cú nhấn, hay dài bằng công việc? |
| `STATE-5` / `STATE-7` | Điều kiện đến từ bên ngoài, hay từ việc của chính phần tử? |
| `STATE-5` / `STATE-8` | Người dùng cần **sửa** giá trị này chứ? Cần thì không được tắt. |
| `STATE-5` / `STATE-9` | Người dùng có cần đọc và sao chép giá trị này không? |
| `STATE-7` / nội dung đang tải | Việc thuộc về phần tử, hay vùng chưa có dữ liệu để vẽ lần đầu? |

## Sai lầm lặp lại nhiều nhất

1. Vẽ `hover:` mà không vẽ `focus-visible:` — bàn phím mất đường vào, ảnh chụp vẫn hoàn hảo.
2. `outline-none` không kèm thứ thay thế.
3. Dùng `focus:` thay `focus-visible:`, thấy xấu, rồi xoá luôn lớp tiêu điểm.
4. Đặt nền chỉ ở `hover:`, không có lớp nghỉ — phần tử kẹt sáng sau cú chạm trên cảm ứng.
5. Đổi hình học ở lớp trạng thái: `hover:border`, `active:font-bold`, thẻ tab chỉ có viền khi được chọn.
6. `disabled` mà quên `pointer-events-none`, nên nút xám vẫn sáng lên khi rê chuột.
7. Dùng `disabled` cho một giá trị chỉ để đọc, thay vì `readOnly`.
8. Thay chữ trên nút bằng biểu tượng đang tải, nút co lại, cả hàng nút nhảy.
9. Vẽ biểu tượng đang tải mà không chặn cú bấm thứ hai.
10. Mã hoá trạng thái bằng riêng màu — không biểu tượng, không chữ, không viền chỉ báo.
11. Đổi CSS mà quên `aria-*`: mắt thấy, trình đọc màn hình không nghe.
12. Giấu thao tác sau `group-hover:` rồi để nó biến mất hoàn toàn trên thiết bị cảm ứng.
13. Báo lỗi bằng một biểu ngữ ở đầu biểu mẫu và bỏ trống lớp lỗi trên từng trường nhập liệu.
14. Không giữ chỗ cho thông báo lỗi, để nút gửi tụt xuống đúng lúc người dùng bấm.
