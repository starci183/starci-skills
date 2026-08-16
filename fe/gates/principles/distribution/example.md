---
id: fe-principles-distribution-example
title: example.md
slug: /gates/principles/distribution/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp và ngoại lệ của từng mã DIST-N, viết bằng className thuần.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `distribution` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **mã đánh dấu thường với `className` thường**. Không thư viện thành phần, không thiết kế
hệ thống riêng, không khoá đăng ký. Một luật chỉ đúng khi nó đúng ở bất kỳ giao diện nào — nên nếu một
ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó sai chỗ.

Mỗi mã có **nhiều trường hợp**, rồi tới **ngoại lệ** và **những thứ trông giống nhưng không phải mã đó**.
Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một mã duy nhất.

Một lưu ý đọc xuyên suốt: mã được gán cho **một người tham gia trên một trục của một phần tử cha**, không
gán cho cả cây. Một hàng có thể chứa cùng lúc `DIST-1`, `DIST-3` và `DIST-6`; bên trong một trong
những phần tử con đó lại là một hàng khác với bộ mã của riêng nó.

---

## `DIST-0` — không khai báo gì

### Trường hợp: cụm nhãn ngắn, mọi giá trị đến từ tập đóng

```tsx
<div className="flex items-center gap-2">
  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">Nền tảng</span>
  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">6 bài</span>
  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">45 phút</span>
</div>
```

Ba giá trị đều sinh ra từ tập đóng và đều ngắn. Không ai cần được ưu tiên, không ai cần được bảo vệ,
và hàng chưa bao giờ thiếu chỗ.

### Trường hợp: biểu tượng và số đếm

```tsx
<span className="inline-flex items-center gap-1 text-sm text-neutral-500">
  <svg aria-hidden="true" className="size-4" />
  <span className="tabular-nums">128</span>
</span>
```

### Trường hợp: phân trang

```tsx
<nav className="flex items-center gap-1">
  <button className="size-8 rounded-md border text-sm" type="button">1</button>
  <button className="size-8 rounded-md border text-sm" type="button">2</button>
  <button className="size-8 rounded-md border text-sm" type="button">3</button>
</nav>
```

### Trường hợp: đường dẫn phân cấp hai cấp cố định

```tsx
<nav className="flex items-center gap-1 text-sm text-neutral-500">
  <a className="hover:underline" href="/">Trang chủ</a>
  <span aria-hidden="true">/</span>
  <span className="text-neutral-900">Cài đặt</span>
</nav>
```

Hai cấp này là hằng số của ứng dụng. Một đường dẫn phân cấp có cấp cuối là **tên do người dùng đặt** thì
không còn nằm ở đây — nó là `DIST-4` cho cấp cuối và `DIST-3` cho các cấp trước.

### Ngoại lệ và nhầm lẫn

- **Chỉ cần một phần tử con sinh ra từ dữ liệu người dùng là hàng hết `DIST-0`.** Cái nhãn nhỏ cuối dưới đây do
  người dùng đặt tên, nên nó không còn là một giá trị đóng nữa:

  ```tsx
  {/* SAI — hàng đã có nội dung không đoán trước, không còn là DIST-0 */}
  <div className="flex items-center gap-2">
    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">Nền tảng</span>
    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">{tag.name}</span>
  </div>
  ```

  ```tsx
  {/* ĐÚNG — chip do người dùng đặt tên được phép co, badge cố định thì không */}
  <div className="flex items-center gap-2">
    <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs">Nền tảng</span>
    <span className="min-w-0 truncate rounded-full bg-neutral-100 px-2 py-0.5 text-xs">{tag.name}</span>
  </div>
  ```

- **Đừng khai báo phòng xa.** Rải `shrink-0` lên mọi phần tử con của một hàng `DIST-0` không làm nó an toàn
  hơn; nó chỉ xoá mất dấu vết về việc phần tử con nào **thật sự** không được co khi hàng này về sau có thêm
  nội dung động.

- **Bản dịch có thể phá vỡ một tập tưởng là đóng.** Nếu một nhãn cố định dài gấp đôi ở ngôn ngữ khác,
  tập đó chưa bao giờ đóng, và hàng phải được gán mã như một hàng có nội dung động.

---

## `DIST-1` — một phần tử con ôm cả hàng

### Trường hợp: tên người và nút hành động

```tsx
<div className="flex items-center gap-3">
  <span className="min-w-0 flex-1 truncate font-medium">{member.fullName}</span>
  <button className="shrink-0 rounded-md border px-3 py-1.5 text-sm" type="button">Mời lại</button>
</div>
```

### Trường hợp: tên tệp, kích thước và nút xoá

```tsx
<div className="flex items-center gap-3 rounded-lg border p-3">
  <svg aria-hidden="true" className="size-5 shrink-0 text-neutral-400" />
  <span className="min-w-0 flex-1 truncate">{file.name}</span>
  <span className="shrink-0 text-sm tabular-nums text-neutral-500">{file.size}</span>
  <button aria-label="Xoá" className="size-8 shrink-0 rounded-md border" type="button" />
</div>
```

Bốn người tham gia, ba mã: biểu tượng, số đo và nút là `DIST-3`; chỉ tên tệp là `DIST-1`. Đây là hình dạng
hay gặp nhất của toàn bộ mô-đun này.

### Trường hợp: ô tìm kiếm trong một thanh công cụ

```tsx
<div className="flex items-center gap-2">
  <input aria-label="Tìm kiếm" className="min-w-0 flex-1 rounded-md border px-3 py-2" />
  <button className="shrink-0 rounded-md border px-3 py-2 text-sm" type="button">Lọc</button>
  <button className="shrink-0 rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="button">Tạo mới</button>
</div>
```

`input` là ngoại lệ nổi tiếng của trình duyệt: nó có bề rộng mặc định riêng và **không** tự thu nhỏ
theo vùng chứa. Không có `min-w-0`, thanh công cụ này tràn ngay ở khổ máy tính bảng.

### Trường hợp: hàng hội thoại — tên và dấu thời gian

```tsx
<div className="flex items-baseline gap-2">
  <strong className="min-w-0 flex-1 truncate">{thread.title}</strong>
  <time className="shrink-0 text-xs tabular-nums text-neutral-500" dateTime={thread.at}>{thread.atLabel}</time>
</div>
```

### Trường hợp: hàng bảng hai cột, cột giá trị dài

```tsx
<div className="flex items-start gap-4 border-b py-3">
  <span className="w-40 shrink-0 text-sm text-neutral-500">Người phụ trách</span>
  <span className="min-w-0 flex-1 truncate">{record.ownerEmail}</span>
</div>
```

### Trường hợp: mã lồng mã — `DIST-1` bên trong một `DIST-1`

```tsx
<div className="flex items-center gap-3 rounded-lg border p-3">
  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-100 text-sm">AN</span>
  <div className="flex min-w-0 flex-1 flex-col gap-1">
    <div className="flex items-baseline gap-2">
      <strong className="min-w-0 flex-1 truncate">{user.fullName}</strong>
      <time className="shrink-0 text-xs tabular-nums text-neutral-500" dateTime={user.joinedAt}>{user.joinedLabel}</time>
    </div>
    <span className="truncate text-sm text-neutral-500">{user.headline}</span>
  </div>
  <button className="shrink-0 rounded-md border px-3 py-1.5 text-sm" type="button">Theo dõi</button>
</div>
```

Hàng ngoài: ảnh đại diện `DIST-3`, cụm chữ `DIST-1`, nút `DIST-3`. Hàng trong: tên `DIST-1`, thời gian
`DIST-3`. Chuỗi `min-w-0` chạy liên tục từ hàng ngoài vào tới phần tử bị cắt — **bỏ một mắt, cả chuỗi
đứng im**.

### Ngoại lệ và nhầm lẫn

- **Thiếu `min-w-0` là hỏng không báo lỗi.** Class CSS danh sách nhìn vẫn đúng, `truncate` vẫn nằm đó, và nút
  vẫn bị đẩy văng ra khỏi thẻ:

  ```tsx
  {/* SAI — child từ chối co dưới bề rộng nội dung, nút bị đẩy ra ngoài */}
  <div className="flex items-center gap-3">
    <span className="flex-1 truncate font-medium">{member.fullName}</span>
    <button className="rounded-md border px-3 py-1.5 text-sm" type="button">Mời lại</button>
  </div>
  ```

- **Hai `flex-1` không phải hai `DIST-1`.** Đó là `DIST-2` viết sai tên, và nó nói sai một điều
  nghiệp vụ: rằng hai cột này ngang hàng nhau.

  ```tsx
  {/* SAI nếu ý định là "tên chiếm phần còn lại" */}
  <div className="flex items-center gap-3">
    <span className="min-w-0 flex-1 truncate">{member.fullName}</span>
    <span className="min-w-0 flex-1 truncate text-sm text-neutral-500">{member.email}</span>
  </div>
  ```

- **`w-full` không thay được `flex-1`.** Trong một hàng có khoảng cách giữa các phần tử, `w-full` là 100% bề rộng phần tử cha, còn
  khoảng cách giữa các phần tử thì được cộng thêm lên trên — hàng tràn đúng bằng tổng các khoảng cách giữa các phần tử.

  ```tsx
  {/* SAI */}  <div className="flex gap-3"><span className="w-full truncate" />…</div>
  ```

- **Nút không phải là người nhường.** Nếu vùng bấm co lại theo bề rộng của phần tử cùng cấp, thứ bị hỏng là
  khả năng thao tác, không phải khả năng đọc.

---

## `DIST-2` — chia đều

### Trường hợp: ba ô số liệu ngang hàng

```tsx
<div className="grid grid-cols-3 gap-4">
  <div className="flex min-w-0 flex-col gap-1 rounded-lg border p-4">
    <span className="text-2xl font-semibold tabular-nums">12</span>
    <span className="truncate text-sm text-neutral-500">khoá đang học</span>
  </div>
  <div className="flex min-w-0 flex-col gap-1 rounded-lg border p-4">
    <span className="text-2xl font-semibold tabular-nums">86</span>
    <span className="truncate text-sm text-neutral-500">bài đã xong</span>
  </div>
  <div className="flex min-w-0 flex-col gap-1 rounded-lg border p-4">
    <span className="text-2xl font-semibold tabular-nums">7</span>
    <span className="truncate text-sm text-neutral-500">ngày liên tiếp</span>
  </div>
</div>
```

Bề rộng bằng nhau ở đây là **một tuyên bố nghiệp vụ**: ba con số này so sánh được với nhau.

### Trường hợp: nhóm nút phân đoạn, mỗi nút một phần bằng nhau

```tsx
<div className="flex rounded-md border p-1">
  <button className="min-w-0 flex-1 truncate rounded px-3 py-1.5 text-sm" type="button">Tất cả</button>
  <button className="min-w-0 flex-1 truncate rounded px-3 py-1.5 text-sm" type="button">Đang học</button>
  <button className="min-w-0 flex-1 truncate rounded px-3 py-1.5 text-sm" type="button">Đã xong</button>
</div>
```

### Trường hợp: hai nút trải hết bề rộng trên thiết bị di động, về tự nhiên ở khổ lớn

```tsx
<div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
  <button className="rounded-md border px-4 py-2 text-sm sm:flex-none" type="button">Huỷ</button>
  <button className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white sm:flex-none" type="submit">Xác nhận</button>
</div>
```

Ở khổ hẹp, hai nút là `DIST-2` trên trục dọc — mỗi nút chiếm trọn bề rộng. Ở khổ lớn, phần tử cha đổi vai
trò và phần dư chuyển sang khoảng cách giữa các phần tử bên trái (`DIST-6` dạng `justify-end`).

### Trường hợp: dải bảy ngày — số cột là dữ kiện của lịch, không phải của nội dung

```tsx
<div className="grid grid-cols-7 gap-1">
  {days.map((day) => (
    <button className="flex min-w-0 flex-col items-center gap-1 rounded-md border py-2" key={day.iso} type="button">
      <span className="text-xs text-neutral-500">{day.weekdayShort}</span>
      <span className="text-sm tabular-nums">{day.dayOfMonth}</span>
    </button>
  ))}
</div>
```

### Trường hợp: chia đều **phần thêm**, không chia đều cột

```tsx
<div className="flex gap-2">
  <button className="grow rounded-md border px-4 py-2 text-sm" type="button">Lưu nháp</button>
  <button className="grow rounded-md bg-neutral-900 px-4 py-2 text-sm text-white" type="submit">Gửi bài đánh giá</button>
</div>
```

`grow` giữ nguyên bề rộng chữ của từng nút rồi chia đều **chỗ thừa**, nên nút chữ dài vẫn rộng hơn.
`flex-1` sẽ ép hai nút bằng nhau và bóp nút chữ dài. Cùng là `DIST-2`; khác nhau ở chỗ điều phải bằng
nhau là **các cột** hay là **phần được thêm vào**.

### Ngoại lệ và nhầm lẫn

- **Đừng chia đều bằng phân số trong phần tử cha có khoảng cách giữa các phần tử:**

  ```tsx
  {/* SAI — 3 × 33.333% cộng thêm 2 seam ⇒ tràn */}
  <div className="flex gap-4">
    <div className="w-1/3">…</div>
    <div className="w-1/3">…</div>
    <div className="w-1/3">…</div>
  </div>
  ```

  ```tsx
  {/* ĐÚNG — parent khai báo số cột, seam được trừ ra trước khi chia */}
  <div className="grid grid-cols-3 gap-4">…</div>
  ```

- **Một cột cố định trong nhóm ⇒ cột đó là `DIST-5`, phần còn lại mới `DIST-2`:**

  ```tsx
  <div className="grid grid-cols-[8rem_repeat(2,minmax(0,1fr))] gap-4">
    <div>…nhãn…</div>
    <div className="min-w-0">…</div>
    <div className="min-w-0">…</div>
  </div>
  ```

- **Lưới `1fr` vẫn cần được gỡ sàn.** `grid-cols-3` là `minmax(auto,1fr)`; một cột chứa chuỗi dài
  không xuống dòng sẽ kéo giãn cả lưới. Khi nội dung không đoán trước, viết
  `grid-cols-[repeat(3,minmax(0,1fr))]` hoặc đặt `min-w-0` lên chính các cột.

---

## `DIST-3` — cấm co

### Trường hợp: ảnh đại diện trong một hàng danh sách

```tsx
<li className="flex items-center gap-3 p-3">
  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-100 text-sm">MT</span>
  <span className="min-w-0 flex-1 truncate">{row.title}</span>
</li>
```

Không có `shrink-0`, ảnh đại diện bị bóp thành hình oval khi tên dài — và một hình tròn méo là dấu hiệu
kinh điển của một hàng chưa được gán mã.

### Trường hợp: giá tiền đứng cạnh tên sản phẩm

```tsx
<div className="flex items-baseline gap-3">
  <span className="min-w-0 flex-1 truncate">{item.name}</span>
  <span className="shrink-0 font-medium tabular-nums">{item.priceLabel}</span>
</div>
```

Một cái tên bị cắt vẫn đọc được. Một cái giá bị cắt thì **sai** — người đọc không phân biệt được
`1.299.000đ` bị cắt với một số nhỏ hơn.

### Trường hợp: nút chỉ có biểu tượng giữ vùng chạm

```tsx
<div className="flex items-center gap-2">
  <p className="min-w-0 flex-1 text-sm">{notice.message}</p>
  <button aria-label="Đóng" className="grid size-8 shrink-0 place-items-center rounded-md" type="button">
    <svg aria-hidden="true" className="size-4" />
  </button>
</div>
```

### Trường hợp: hộp kiểm và nhãn trạng thái trong một hàng chọn được

```tsx
<label className="flex items-center gap-3 p-3">
  <input className="size-4 shrink-0" type="checkbox" />
  <span className="min-w-0 flex-1 truncate">{task.title}</span>
  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Cần duyệt</span>
</label>
```

Nhãn trạng thái là một giá trị từ tập đóng và là thứ người đọc quét theo cột — cắt nó đi thì cột đó
mất công dụng. Nó là `DIST-3` dù đứng sau một `DIST-1`.

### Trường hợp: phần tử con vừa giãn vừa cấm cắt

```tsx
<div className="flex items-center gap-2">
  <button className="shrink-0 grow rounded-md border px-4 py-2 text-sm" type="button">Đăng ký học thử</button>
  <span className="min-w-0 truncate text-sm text-neutral-500">{plan.note}</span>
</div>
```

Nút lấy phần dư nhưng từ chối phần thiếu, nên nó là `DIST-3` chứ không phải `DIST-1`. **Phần thiếu
quyết định mã.** Vì thế hàng phải có người khác đứng ra nhường — ở đây là dòng ghi chú `DIST-4`.

### Ngoại lệ và nhầm lẫn

- **`shrink-0` nói một điều, `flex-none` nói hai.** `flex-none` cấm luôn cả giãn, mà cấm giãn đã là
  mặc định — người đọc sau không biết vế nào là chủ ý.

  ```tsx
  {/* Nói vừa đủ */}   <button className="shrink-0" type="button">Mời lại</button>
  {/* Nói dư một vế */} <button className="flex-none" type="button">Mời lại</button>
  ```

- **`shrink-0` không phải cách sửa tràn.** Khoá mọi phần tử con lại thì hàng không co được nữa và phần
  thiếu đi thẳng ra ngoài vùng chứa:

  ```tsx
  {/* SAI — không còn ai nhường, hàng tràn */}
  <div className="flex items-center gap-3">
    <span className="shrink-0 truncate">{member.fullName}</span>
    <span className="shrink-0 truncate">{member.email}</span>
    <button className="shrink-0" type="button">Mời lại</button>
  </div>
  ```

- **Ảnh cần cả hai vế.** `shrink-0` giữ ô, `object-cover` giữ tỉ lệ bên trong ô; thiếu vế nào cũng
  méo:

  ```tsx
  <img alt="" className="size-16 shrink-0 rounded-md object-cover" src={course.cover} />
  ```

---

## `DIST-4` — phải được phép co, nhưng không lấy phần dư

### Trường hợp: cụm nhận diện cạnh ảnh đại diện, không được kéo dài ra

```tsx
<div className="flex items-center gap-2">
  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-100 text-xs">AN</span>
  <span className="min-w-0 truncate text-sm">{user.fullName}</span>
</div>
```

Nếu dùng `flex-1` ở đây, cụm chữ sẽ giãn ra chạm mép và tách rời khỏi ảnh đại diện — nghĩa của cụm nhận
diện bị nói sai. `DIST-4` co khi hẹp, đứng yên khi rộng.

### Trường hợp: nhãn nhỏ bộ lọc do người dùng đặt tên

```tsx
<div className="flex flex-wrap items-center gap-2">
  <span className="flex min-w-0 items-center gap-1 rounded-full border px-2 py-1 text-xs">
    <span className="min-w-0 truncate">{filter.label}</span>
    <button aria-label="Bỏ lọc" className="size-4 shrink-0" type="button" />
  </span>
</div>
```

### Trường hợp: mã lồng mã — `DIST-4` nằm trong một `DIST-3`

```tsx
<button className="flex w-40 shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm" type="button">
  <svg aria-hidden="true" className="size-4 shrink-0" />
  <span className="min-w-0 truncate">{branch.name}</span>
  <svg aria-hidden="true" className="size-4 shrink-0" />
</button>
```

Bản thân nút là `DIST-5` với hàng cha (số đo do bố cục quyết định). Bên trong nó, hai biểu tượng là
`DIST-3` và nhãn là `DIST-4`: nhãn phải co để nút giữ được số đo của mình.

### Trường hợp: đường dẫn phân cấp có cấp cuối là tên do người dùng đặt

```tsx
<nav className="flex items-center gap-1 text-sm">
  <a className="shrink-0 text-neutral-500" href="/files">Tệp</a>
  <span aria-hidden="true" className="shrink-0 text-neutral-400">/</span>
  <a className="shrink-0 text-neutral-500" href={parent.href}>{parent.shortName}</a>
  <span aria-hidden="true" className="shrink-0 text-neutral-400">/</span>
  <span className="min-w-0 truncate">{current.name}</span>
</nav>
```

Chỉ cấp cuối được phép co, và nó không được phép giãn — nếu giãn, đường dẫn phân cấp bị kéo rời khỏi các cấp
trước và không còn đọc ra một đường dẫn liền mạch.

### Trường hợp: vùng cuộn trong một cột flex — cùng luật, trục dọc

```tsx
<div className="flex h-96 flex-col rounded-lg border">
  <div className="shrink-0 border-b p-3 font-medium">Bình luận</div>
  <div className="min-h-0 flex-1 overflow-y-auto p-3">…danh sách bình luận…</div>
  <div className="shrink-0 border-t p-3">…ô nhập…</div>
</div>
```

Thiếu `min-h-0`, vùng giữa **giãn vượt** chiều cao 96 thay vì cuộn, và trần bị đẩy xuống cho tới khi
cả trang cuộn thay nó.

### Trường hợp: chuỗi `min-w-0` phải chạy suốt

```tsx
<div className="flex items-center gap-3">
  <div className="min-w-0 flex-1">
    <div className="flex items-center gap-2">
      <span className="min-w-0 truncate font-medium">{repo.name}</span>
      <span className="shrink-0 rounded-full border px-2 text-xs">công khai</span>
    </div>
  </div>
  <button className="shrink-0 rounded-md border px-3 py-1.5 text-sm" type="button">Sao chép</button>
</div>
```

Có `min-w-0` ở tầng ngoài mà thiếu ở tầng trong thì `truncate` vẫn nằm im. **Quyền được co không di
truyền.**

### Ngoại lệ và nhầm lẫn

- **`min-w-0` không phải là thứ để rải khắp nơi.** Nó là **quyền được co** cấp cho đúng những mắt
  xích trên đường đi tới phần tử phải nhường. Rải bừa thì lần sau không ai đọc ra được ai là người
  nhường thật.

- **`overflow-hidden` không thay được `min-w-0`.** Nó cắt phần thừa nhưng không đổi bề rộng tối thiểu
  của phần tử con flex, nên phần tử cùng cấp vẫn bị đẩy:

  ```tsx
  {/* SAI — vẫn đẩy sibling ra khỏi hàng */}
  <div className="flex gap-2"><span className="overflow-hidden">{long}</span><button type="button">Sửa</button></div>
  ```

- **`truncate` trên chính phần tử cha không cứu được phần tử con.** `truncate` gồm `overflow-hidden`, và như
  trên, nó không cấp quyền co cho một phần tử con flex nằm trong đó.

---

## `DIST-5` — số đo do bố cục quyết định

### Trường hợp: thanh dọc lọc cạnh vùng kết quả

```tsx
<div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
  <aside className="flex flex-col gap-4">…bộ lọc…</aside>
  <section className="min-w-0">…kết quả…</section>
</div>
```

`16rem` là số đo của bố cục; `minmax(0,1fr)` là cách lưới viết `min-w-0` cho cột còn lại. Thiếu `0`
trong `minmax`, một kết quả có chuỗi dài không ngắt được sẽ kéo giãn cả lưới.

### Trường hợp: cùng hình dạng đó nhưng dựng bằng flex

```tsx
<div className="flex gap-8">
  <aside className="w-64 shrink-0">…bộ lọc…</aside>
  <section className="min-w-0 flex-1">…kết quả…</section>
</div>
```

`w-64` **một mình** không giữ được gì: flex bật co sẵn, nên thanh dọc âm thầm hẹp lại khi kết quả dài.
`DIST-5` luôn là hai tuyên bố — số đo, và lời từ chối nhường nó.

### Trường hợp: cột nhãn của biểu mẫu hai cột

```tsx
<div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
  <label className="text-sm font-medium" htmlFor="visibility">Phạm vi hiển thị</label>
  <select className="min-w-0 rounded-md border px-3 py-2" id="visibility">…</select>
</div>
```

### Trường hợp: cột số thứ tự trong một bảng xếp hạng

```tsx
<li className="flex items-center gap-3 p-3">
  <span className="w-8 shrink-0 text-right text-sm tabular-nums text-neutral-500">{row.rank}</span>
  <span className="min-w-0 flex-1 truncate">{row.name}</span>
  <span className="shrink-0 text-sm tabular-nums">{row.points}</span>
</li>
```

`w-8` ở đây không đến từ nội dung: nó đến từ quyết định rằng **mọi hàng phải thẳng cột**, kể cả hàng
có số một chữ số. Đó là điều `DIST-3` không làm được — `DIST-3` chỉ khoá bề rộng nội dung của từng
hàng, mỗi hàng một khác.

### Trường hợp: mã lồng mã — một `DIST-5` chứa nguyên một hàng có bộ mã riêng

```tsx
<div className="flex gap-8">
  <aside className="w-64 shrink-0">
    <div className="flex items-center gap-2">
      <h3 className="min-w-0 truncate text-sm font-medium">{filterGroup.name}</h3>
      <button className="ml-auto shrink-0 text-xs text-neutral-500" type="button">Xoá</button>
    </div>
  </aside>
  <section className="min-w-0 flex-1">…kết quả…</section>
</div>
```

Hàng ngoài: thanh dọc `DIST-5`, kết quả `DIST-1`. Hàng trong thanh dọc: tiêu đề `DIST-4`, nút `DIST-3`, và chỗ
thừa đi vào khoảng cách giữa các phần tử `DIST-6`. Bên trong thanh dọc **không** dùng `flex-1` cho tiêu đề, vì thanh dọc đã có bề rộng
cố định và tiêu đề chỉ cần được phép co.

### Trường hợp: khung ghim bên phải, nội dung bên trái

```tsx
<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
  <section className="min-w-0">…danh mục…</section>
  <aside className="lg:sticky lg:top-24">…tóm tắt đơn hàng…</aside>
</div>
```

### Ngoại lệ và nhầm lẫn

- **Số đo cố định không có nghĩa là cấm đổi theo khổ màn.** Đổi số đo là đổi một quyết định bố cục,
  không phải đổi mã:

  ```tsx
  <aside className="w-56 shrink-0 xl:w-72">…</aside>
  ```

- **Khi thanh dọc xếp chồng lên trên nội dung ở khổ hẹp, đó là phần tử cha khác:**

  ```tsx
  <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
    <aside className="lg:w-64 lg:shrink-0">…bộ lọc…</aside>
    <section className="min-w-0 lg:flex-1">…kết quả…</section>
  </div>
  ```

  Ở khổ hẹp, trục là dọc và thanh dọc chiếm trọn bề rộng — nó không còn là `DIST-5` của trục ngang nữa. Mã
  đổi vì **phần tử cha đổi**, không vì màn hình hẹp đi.

- **Đừng lấy `max-w-*` thay cho `w-*` rồi tưởng đã cố định.** `max-w-*` chỉ đặt trần; bề rộng thật
  vẫn do nội dung và phần thiếu quyết định.

---

## `DIST-6` — phần dư rơi vào khoảng cách giữa các phần tử

### Trường hợp: phần đầu thẻ — tiêu đề trái, trình đơn phải

```tsx
<div className="flex items-center gap-2">
  <h3 className="min-w-0 truncate font-medium">{card.title}</h3>
  <button aria-label="Tuỳ chọn" className="ml-auto size-8 shrink-0 rounded-md border" type="button" />
</div>
```

Tiêu đề **không** giãn ra: nó chỉ được phép co (`DIST-4`). Chỗ thừa đi vào khoảng cách giữa các phần tử do `ml-auto` mở ra.

### Trường hợp: hàng tổng tiền

```tsx
<div className="flex items-baseline gap-2 border-t pt-3">
  <span className="text-sm text-neutral-500">Tổng thanh toán</span>
  <span className="ml-auto font-semibold tabular-nums">{order.totalLabel}</span>
</div>
```

### Trường hợp: phần cuối hộp thoại — nút phụ trái, nhóm nút chính phải

```tsx
<div className="flex items-center gap-2 border-t pt-4">
  <button className="text-sm text-neutral-500" type="button">Khôi phục mặc định</button>
  <div className="ml-auto flex items-center gap-2">
    <button className="rounded-md border px-3 py-2 text-sm" type="button">Huỷ</button>
    <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="submit">Lưu</button>
  </div>
</div>
```

Gom hai nút phải thành **một** nhóm, rồi mở đúng **một** khoảng cách giữa các phần tử. Đây là cách viết đúng của ý định "một
bên trái, một bên phải" khi có ba thành phần điều khiển trở lên.

### Trường hợp: hàng danh sách — nội dung trái, biểu tượng chữ V sát phải

```tsx
<a className="flex items-center gap-3 p-4" href={lesson.href}>
  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-neutral-100 text-xs tabular-nums">{lesson.index}</span>
  <span className="flex min-w-0 flex-col gap-1">
    <span className="truncate font-medium">{lesson.title}</span>
    <span className="truncate text-sm text-neutral-500">{lesson.durationLabel}</span>
  </span>
  <svg aria-hidden="true" className="ml-auto size-4 shrink-0 text-neutral-400" />
</a>
```

Cụm chữ ở giữa là `DIST-4`: nó co khi hẹp và **không** giãn khi rộng, nên biểu tượng chữ V được đẩy tới mép
bởi khoảng cách giữa các phần tử chứ không bởi một phần tử con bị kéo dài. Đổi cụm chữ thành `flex-1` thì hiển thị trông y hệt — và
sai, vì lúc đó chỗ thừa nằm **bên trong** cụm chữ.

### Trường hợp: thanh công cụ — nhóm bộ lọc trái, nút tạo mới phải

```tsx
<div className="flex flex-wrap items-center gap-2">
  <div className="flex min-w-0 items-center gap-2">
    <button className="rounded-full border px-3 py-1 text-sm" type="button">Tất cả</button>
    <button className="rounded-full border px-3 py-1 text-sm" type="button">Đang mở</button>
  </div>
  <button className="ml-auto shrink-0 rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="button">Tạo mới</button>
</div>
```

### Ngoại lệ và nhầm lẫn

- **`flex-1` để đẩy là nhầm lẫn đắt nhất của mô-đun này:**

  ```tsx
  {/* SAI — tiêu đề bị biến thành vùng nhận cả phần thiếu, và vùng bấm kéo dài qua chỗ trống */}
  <div className="flex items-center gap-2">
    <button className="flex-1 text-left font-medium" type="button">{card.title}</button>
    <button aria-label="Tuỳ chọn" className="size-8" type="button" />
  </div>
  ```

  ```tsx
  {/* ĐÚNG — chỗ thừa vào seam, vùng bấm bằng đúng chữ */}
  <div className="flex items-center gap-2">
    <button className="min-w-0 truncate text-left font-medium" type="button">{card.title}</button>
    <button aria-label="Tuỳ chọn" className="ml-auto size-8 shrink-0" type="button" />
  </div>
  ```

- **Không dùng phần tử rỗng để đẩy:**

  ```tsx
  {/* SAI */}  <div className="flex"><span>Nhãn</span><div className="flex-1" /><span>Giá trị</span></div>
  {/* ĐÚNG */} <div className="flex"><span>Nhãn</span><span className="ml-auto">Giá trị</span></div>
  ```

- **`justify-between` với ba phần tử con chia chỗ thừa cho *mọi* khoảng cách giữa các phần tử:**

  ```tsx
  {/* SAI nếu ý định là "một bên trái, hai bên phải" */}
  <div className="flex items-center justify-between">
    <span>Nhãn</span>
    <button type="button">Huỷ</button>
    <button type="submit">Lưu</button>
  </div>
  ```

- **`justify-between` và `ml-auto` không dùng chung.** Hai cách nói cùng một quyết định, đặt cạnh
  nhau thì lần sửa sau không biết cái nào đang có hiệu lực.

---

## Ánh xạ yêu cầu sang một mã

Nêu phần tử cha, các người tham gia và hành vi khi thiếu chỗ. Nếu thiếu **một** dữ kiện quyết định, hỏi
**một** câu cụ thể rồi dừng. Câu trả lời phải là một chuỗi class CSS hoặc một câu hỏi — không bao giờ cả
hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Tên bên trái, nút bên phải, tên dài thì cắt bớt | Chỉ một nội dung động, nó vừa lấy vừa nhường | `DIST-1` | `min-w-0 flex-1` + `shrink-0` |
| Ba ô số liệu bằng nhau | Bề rộng bằng nhau là tuyên bố so sánh được | `DIST-2` | `grid grid-cols-3` |
| Hai nút cùng trải hết hàng, nút chữ dài được rộng hơn | Chia đều **phần thêm**, không chia đều cột | `DIST-2` | `grow` mỗi nút |
| Ảnh đại diện không được méo khi tên dài | Méo là hiểu sai, không phải đọc ít đi | `DIST-3` | `shrink-0` |
| Giá không bao giờ được cắt, dù tên dài cỡ nào | Giá trị không kiểm chứng được sau khi cắt | `DIST-3` | `shrink-0` |
| Nhãn cạnh ảnh đại diện được cắt bớt, nhưng đừng kéo dài ra | Nhường mà không lấy | `DIST-4` | `min-w-0` |
| Vùng bình luận cuộn trong khung cao cố định | Trục dọc, gỡ sàn chiều cao | `DIST-4` | `min-h-0 flex-1 overflow-y-auto` |
| Thanh dọc lọc rộng 16rem, kết quả chiếm phần còn lại | Số đo đến từ quyết định bố cục | `DIST-5` + `DIST-1` | `grid-cols-[16rem_minmax(0,1fr)]` |
| Đẩy nút này sang sát mép phải | Thứ phải to ra là **khoảng cách**, không phải phần tử con | `DIST-6` | `ml-auto` |
| Dàn ba nhãn trạng thái cố định trên một hàng | Không có nội dung động, chưa từng thiếu chỗ | `DIST-0` | không class CSS |
| Hiện tiêu đề và một nhãn phụ trên cùng một hàng | Chưa biết nhãn phụ có phải nội dung động không ⇒ lấy mã khai báo ít hơn | `DIST-4` | `min-w-0 truncate` |

Ở dòng cuối, câu hỏi phân định **chỉ** được hỏi khi bên yêu cầu nói rõ họ cần vai trò lớn hơn:
*"Nhãn phụ này có phải là thứ duy nhất được lấy hết chỗ thừa của hàng không?"*

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `DIST-0` / `DIST-3` | Có dữ liệu thật nào làm hàng này thiếu chỗ không? |
| `DIST-1` / `DIST-2` | Có **một** nội dung động, hay nhiều mục đồng hạng? |
| `DIST-1` / `DIST-4` | Khi hàng rộng ra, phần tử con này nên phình ra hay đứng yên? |
| `DIST-1` / `DIST-6` | Thứ cần to ra là một phần tử con, hay là khoảng cách giữa các phần tử con? |
| `DIST-2` / `DIST-5` | Cái phải bằng nhau là các cột, hay có một cột đã được chốt số đo? |
| `DIST-3` / `DIST-4` | Nhỏ lại thì người đọc hiểu **sai**, hay chỉ đọc được **ít hơn**? |
| `DIST-3` / `DIST-5` | Số đo đến từ nội dung của chính nó, hay từ một quyết định bố cục? |
| `DIST-3` / `DIST-1` khi phần tử con vừa giãn vừa cấm cắt | Phần thiếu quyết định: cấm cắt ⇒ `DIST-3`, và hàng phải tìm người khác nhường |

## Sai lầm lặp lại nhiều nhất

1. Viết `flex-1` mà quên `min-w-0` — phần tử con từ chối co và đẩy phần tử cùng cấp văng ra khỏi hàng.
2. Đặt `min-w-0` ở tầng ngoài rồi tưởng tầng trong cũng có; quyền được co **không di truyền**.
3. Dùng `flex-1` để **đẩy** một thứ sang mép, biến một tiêu đề thành vùng nhận cả phần thiếu.
4. Viết `w-64` mà quên `shrink-0`, rồi kết luận là "Tailwind không ăn".
5. Dùng phân số (`w-1/3`) trong phần tử cha có khoảng cách giữa các phần tử, khoảng cách giữa các phần tử cộng thêm lên trên và hàng tràn.
6. Rải `shrink-0` lên mọi phần tử con để "chữa tràn", khiến hàng không còn ai nhường.
7. Quên `minmax(0,1fr)` trong lưới, rồi một chuỗi dài kéo giãn cả trang.
8. Quên `min-h-0` cho vùng cuộn trong cột flex, rồi có hai thanh cuộn.
9. Chèn `<div className="flex-1" />` rỗng làm miếng đệm.
10. Đổi mã khi thiết kế đáp ứng dù phần tử cha không đổi.
