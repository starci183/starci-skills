---
id: fe-principles-ratio-example
title: example.md
slug: /gates/principles/ratio/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp và ngoại lệ của từng mã RATIO-N, viết bằng className thuần.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `ratio` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **mã đánh dấu thường với `className` thường**. Không thư viện thành phần, không thiết kế
hệ thống riêng, không khoá đăng ký. Một luật chỉ đúng khi nó đúng ở bất kỳ giao diện nào — nên nếu một
ví dụ cần tên riêng của một sản phẩm để đọc được, ví dụ đó sai chỗ.

Mỗi mã có **nhiều trường hợp**, rồi tới **ngoại lệ** và **những thứ trông giống nhưng không phải mã đó**.
Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một cặp khung-và-cách khớp duy nhất.

Đọc mỗi ví dụ bằng một câu hỏi duy nhất: *trước khi biết tệp là gì, khung này đã hứa dành ra bao
nhiêu chỗ?*

---

## `RATIO-0` — nguồn đã tự khai kích thước

### Trường hợp: ảnh tĩnh có kích thước thật trong mã đánh dấu

```tsx
<img
  alt="Sơ đồ luồng thanh toán"
  className="h-auto w-full rounded-lg border"
  height={900}
  src="/media/payment-flow.png"
  width={1600}
/>
```

Không có tỷ lệ class CSS, và vẫn không nhảy: hai thuộc tính `width`/`height` đã giữ chỗ trước khi byte
đầu tiên về. Đây là bằng chứng mà `RATIO-0` đòi hỏi — thiếu nó thì mã này không hợp lệ.

### Trường hợp: véc-tơ nội tuyến đã mang tỉ lệ theo mình

```tsx
<svg aria-hidden="true" className="w-full text-neutral-400" viewBox="0 0 240 80">
  <path d="M0 40h240" stroke="currentColor" strokeWidth="2" />
</svg>
```

### Trường hợp: biểu tượng có kích thước cố định hai chiều

```tsx
<span className="inline-flex size-4 items-center justify-center">
  <svg aria-hidden="true" className="size-4" viewBox="0 0 16 16" />
</span>
```

### Trường hợp: minh hoạ trong bài viết, asset nằm sẵn trong gói

```tsx
<figure className="flex flex-col gap-2">
  <img
    alt="Kiến trúc hàng đợi ghi"
    className="h-auto w-full rounded-lg border"
    height={720}
    src="/media/write-queue.png"
    width={1280}
  />
  <figcaption className="text-sm text-neutral-500">Hàng đợi ghi và bản sao đọc</figcaption>
</figure>
```

### Ngoại lệ và nhầm lẫn

- **Không có `width`/`height` thì không phải `RATIO-0`.** Đây là lỗi hay gặp nhất của cả mô-đun:

  ```tsx
  {/* SAI — chưa ai quyết định, và trang sẽ nhảy khi ảnh về */}
  <img alt="" className="w-full rounded-lg" src={post.coverUrl} />
  ```

  ```tsx
  {/* ĐÚNG — khung khai hình dạng, ảnh lấp đầy khung */}
  <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-neutral-100">
    <img alt="" className="size-full object-cover object-center" src={post.coverUrl} />
  </div>
  ```

- **Véc-tơ đã có `viewBox` thì không gắn thêm tỷ lệ class CSS** — hai lời khai cho một sự thật:

  ```tsx
  {/* SAI */}  <svg className="aspect-video w-full" viewBox="0 0 240 80" />
  {/* ĐÚNG */} <svg className="w-full" viewBox="0 0 240 80" />
  ```

- **`width`/`height` phải là số thật của tệp.** Điền số ước lượng còn tệ hơn bỏ trống: bố cục không
  nhảy nhưng ảnh bị kéo méo, và không ai nhìn ra nguyên nhân.
- **Ảnh do người dùng tải lên gần như không bao giờ là `RATIO-0`**, vì kích thước không có mặt lúc
  viết mã. Nó là `RATIO-4` tính theo bản ghi, hoặc `RATIO-5`.

---

## `RATIO-1` — bố cục cần ô vuông

### Trường hợp: ảnh đại diện trong một dòng nhận diện

```tsx
<div className="flex items-center gap-2">
  <span className="size-10 shrink-0 overflow-hidden rounded-full bg-neutral-100">
    <img alt="" className="size-full object-cover object-center" src={user.avatarUrl} />
  </span>
  <span className="flex flex-col gap-1">
    <strong>Nguyễn Văn An</strong>
    <span className="text-sm text-neutral-500">@an.nguyen</span>
  </span>
</div>
```

Khung `size-10` đã vuông sẵn, nên `aspect-square` là thừa. Điều bắt buộc ở đây là `object-cover` —
không có nó, ảnh dọc sẽ bị nén ngang thành mặt người bẹp.

### Trường hợp: lưới thư viện ảnh, các ô phải khớp nhau

```tsx
<ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
  {photos.map((photo) => (
    <li className="aspect-square overflow-hidden rounded-lg bg-neutral-100" key={photo.id}>
      <img alt={photo.alt} className="size-full object-cover object-center" src={photo.url} />
    </li>
  ))}
</ul>
```

### Trường hợp: ảnh đại diện chồng nhau trong một cụm thành viên

```tsx
<div className="flex items-center -space-x-2">
  {members.map((member) => (
    <span
      className="size-8 overflow-hidden rounded-full border-2 border-white bg-neutral-100"
      key={member.id}
    >
      <img alt="" className="size-full object-cover object-center" src={member.avatarUrl} />
    </span>
  ))}
</div>
```

### Trường hợp: ảnh chân dung cắt từ trên xuống

```tsx
<div className="aspect-square w-full overflow-hidden rounded-lg bg-neutral-100">
  <img alt="" className="size-full object-cover object-top" src={person.photoUrl} />
</div>
```

Neo `object-top` là một quyết định nghiệp vụ: ảnh chân dung mất chân thì vẫn đọc được, mất đầu thì
không.

### Trường hợp: khung chờ của cùng khung đó

```tsx
<div className="aspect-square w-full animate-pulse rounded-lg bg-neutral-200" />
```

Khung chờ dùng **đúng** `aspect-square` của trạng thái đã tải. Bằng chứng của một tỉ lệ đã khai là
không có gì dịch chuyển khi ảnh về.

### Trường hợp: ảnh đại diện phương án dự phòng khi không có ảnh — vẫn giữ khung

```tsx
<span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-neutral-100 text-sm">
  {user.avatarUrl
    ? <img alt="" className="size-full object-cover object-center" src={user.avatarUrl} />
    : <span className="font-medium text-neutral-600">AN</span>}
</span>
```

### Ngoại lệ và nhầm lẫn

- **`rounded-full` trên khung chưa vuông là một cái bầu dục.** Bo tròn không tạo ra hình vuông:

  ```tsx
  {/* SAI */}  <img className="h-10 w-14 rounded-full object-cover" src={user.avatarUrl} />
  {/* ĐÚNG */} <img className="size-10 rounded-full object-cover object-center" src={user.avatarUrl} />
  ```

- **Không cắt thì méo.** Khung vuông mà thiếu `object-cover` là ép ảnh đổi hình dạng:

  ```tsx
  {/* SAI */}  <div className="aspect-square"><img className="size-full" src={photo.url} /></div>
  ```

- **Không cắt thật thì tràn.** Khung có bo góc mà thiếu `overflow-hidden` sẽ để góc ảnh nhô ra:

  ```tsx
  {/* SAI */}  <div className="aspect-square rounded-lg"><img className="size-full object-cover" /></div>
  {/* ĐÚNG */} <div className="aspect-square overflow-hidden rounded-lg"><img className="size-full object-cover" /></div>
  ```

- **Biểu trưng đối tác không phải `RATIO-1` dù lưới muốn vuông.** Xén chữ trong biểu trưng là mất thông tin ⇒
  `RATIO-5`.
- **`aspect-[1/1]` là cách viết vòng của `aspect-square`.** Cùng một tỉ lệ, hai cái tên, và bản kiểm
  tra sau này sẽ không nhận ra chúng là một.

---

## `RATIO-2` — nội dung động, hoặc ảnh đứng thay cho nó

### Trường hợp: ảnh thu nhỏ bài giảng có thời lượng chồng lên

```tsx
<a className="flex flex-col gap-3" href={lesson.href}>
  <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-neutral-100">
    <img alt="" className="size-full object-cover object-center" src={lesson.thumbnailUrl} />
    <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white tabular-nums">
      12:40
    </span>
  </div>
  <span className="font-medium">Đọc và ghi theo cơ chế quorum</span>
</a>
```

Tỉ lệ nằm ở **khung**, không nằm ở `<img>`. Nếu đặt `aspect-video` lên `<img>` thì cái nhãn thời
lượng sẽ định vị theo một hộp khác với hộp mà người đọc nhìn thấy.

### Trường hợp: trình phát video

```tsx
<div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
  <video className="size-full" controls poster={lesson.posterUrl} src={lesson.videoUrl} />
</div>
```

Nền đen là một phần của mã này: trình phát tự `contain` nội dung bên trong, và phần thừa phải nhìn ra
là phần thừa cố ý.

### Trường hợp: nội dung nhúng bên thứ ba — không kiểm soát nội dung, vẫn sở hữu khung

```tsx
<div className="relative aspect-video w-full overflow-hidden rounded-lg bg-neutral-100">
  <iframe
    allowFullScreen
    className="absolute inset-0 size-full"
    src={embedUrl}
    title="Bản ghi buổi học"
  />
</div>
```

### Trường hợp: ảnh đại diện buổi phát trực tiếp

```tsx
<div className="relative aspect-video w-full overflow-hidden rounded-lg bg-neutral-100">
  <img alt="" className="size-full object-cover object-center" src={stream.previewUrl} />
  <span className="absolute left-2 top-2 rounded bg-red-600 px-1.5 py-0.5 text-xs font-medium text-white">
    Đang phát
  </span>
</div>
```

### Trường hợp: khung nhúng bản đồ tương tác

```tsx
<div className="aspect-video w-full overflow-hidden rounded-lg border">
  <iframe className="size-full" src={mapUrl} title="Bản đồ địa điểm" />
</div>
```

### Trường hợp: trạng thái lỗi tải — giữ nguyên khung

```tsx
<div className="grid aspect-video w-full place-items-center rounded-lg bg-neutral-100 text-sm text-neutral-500">
  Không tải được bản xem trước
</div>
```

### Ngoại lệ và nhầm lẫn

- **"Rộng" không phải là `RATIO-2`.** Một băng khuyến mãi 3:1 là `RATIO-4`, vì nó không thay mặt cho
  nội dung động nào:

  ```tsx
  {/* SAI */}  <div className="aspect-video w-full">…băng khuyến mãi…</div>
  {/* ĐÚNG */} <div className="aspect-[3/1] w-full overflow-hidden rounded-lg">…băng khuyến mãi…</div>
  ```

- **Video dọc do người dùng quay thì cắt vào 16:9 là mất hết** ⇒ khung vẫn có chặn nhưng nội dung
  `contain`, tức là `RATIO-5`:

  ```tsx
  <div className="grid aspect-video w-full place-items-center overflow-hidden rounded-lg bg-neutral-900">
    <video className="max-h-full max-w-full object-contain" controls src={clip.url} />
  </div>
  ```

- **Đừng đặt tỉ lệ lên cả khung lẫn ảnh:**

  ```tsx
  {/* SAI */}
  <div className="aspect-video overflow-hidden">
    <img className="aspect-video size-full object-cover" src={lesson.thumbnailUrl} />
  </div>
  ```

- **Đừng đặt tỉ lệ cạnh chiều cao cố định:**

  ```tsx
  {/* SAI — hai lời khai, một cái thắng trong im lặng */}
  <div className="aspect-video h-40 w-full">…</div>
  ```

---

## `RATIO-3` — ảnh chụp tĩnh cần chiều cao

### Trường hợp: ảnh bìa bài viết

```tsx
<article className="flex flex-col gap-3">
  <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-neutral-100">
    <img alt="" className="size-full object-cover object-center" src={post.coverUrl} />
  </div>
  <h3 className="font-medium">Vì sao retry cần idempotency key</h3>
</article>
```

### Trường hợp: lưới ảnh phòng trong trang đặt chỗ

```tsx
<ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
  {rooms.map((room) => (
    <li className="flex flex-col gap-2" key={room.id}>
      <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-neutral-100">
        <img alt={room.name} className="size-full object-cover object-center" src={room.photoUrl} />
      </div>
      <span className="text-sm font-medium">{room.name}</span>
    </li>
  ))}
</ul>
```

Lưới khớp nhau bằng **cột**, không bằng việc ép ảnh chụp thành vuông. Đây là chỗ `RATIO-3` thắng
`RATIO-1` khi cả hai cùng có vẻ hợp lý: chọn mã cắt ít hơn.

### Trường hợp: ảnh chân dung giảng viên trong hồ sơ

```tsx
<div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-neutral-100">
  <img alt="" className="size-full object-cover object-top" src={instructor.photoUrl} />
</div>
```

### Trường hợp: khung chờ cùng khung

```tsx
<div className="aspect-[4/3] w-full animate-pulse rounded-lg bg-neutral-200" />
```

### Ngoại lệ và nhầm lẫn

- **Ảnh dọc không tự biến khung thành dọc.** Khung là cam kết của bố cục, nguồn là dữ liệu:

  ```tsx
  {/* SAI — đổi khung theo từng tấm ảnh ⇒ lưới vỡ nhịp */}
  <div className={photo.isPortrait ? "aspect-[3/4]" : "aspect-[4/3]"}>…</div>
  ```

  Nếu **thật sự** cần mỗi bản ghi giữ hình dạng riêng thì đó là `RATIO-4` tính theo bản ghi, khai từ
  `width`/`height` của dữ liệu, chứ không phải một cờ boolean đoán ra từ ảnh.

- **Ảnh chụp màn hình không phải `RATIO-3`.** Nó có bốn cạnh đều mang nghĩa ⇒ `RATIO-5`.
- **Đừng lấy `aspect-[4/3]` làm mặc định cho mọi thứ.** Mã được chọn từ *cái khung thay mặt cho gì*,
  không phải từ *tỉ lệ nào ít gây tranh cãi nhất*.

---

## `RATIO-4` — sản phẩm tự đặt một tỉ lệ

### Trường hợp: băng khuyến mãi rất rộng

```tsx
<div className="aspect-[3/1] w-full overflow-hidden rounded-lg bg-neutral-100">
  <img alt="" className="size-full object-cover object-center" src={promo.bannerUrl} />
</div>
```

### Trường hợp: ảnh bìa hồ sơ, có ảnh đại diện đè lên

```tsx
<div className="flex flex-col gap-3">
  <div className="relative aspect-[4/1] w-full overflow-hidden rounded-lg bg-neutral-100">
    <img alt="" className="size-full object-cover object-center" src={profile.bannerUrl} />
  </div>
  <div className="flex items-center gap-2">
    <span className="size-16 shrink-0 overflow-hidden rounded-full border-4 border-white bg-neutral-100">
      <img alt="" className="size-full object-cover object-center" src={profile.avatarUrl} />
    </span>
    <strong>{profile.displayName}</strong>
  </div>
</div>
```

Hai mã trong một khối: băng bìa là `RATIO-4` vì 4:1 là con số của sản phẩm; ảnh đại diện là `RATIO-1` vì
các ảnh đại diện phải khớp nhau ở mọi nơi khác trong sản phẩm.

### Trường hợp: ảnh bìa sách 2:3

```tsx
<div className="aspect-[2/3] w-40 overflow-hidden rounded-md bg-neutral-100 shadow-sm">
  <img alt={book.title} className="size-full object-cover object-center" src={book.coverUrl} />
</div>
```

### Trường hợp: tỉ lệ tính theo từng bản ghi, khai bằng dữ liệu

```tsx
<div
  className="w-full overflow-hidden rounded-lg bg-neutral-100"
  style={{ aspectRatio: `${asset.width} / ${asset.height}` }}
>
  <img alt={asset.alt} className="size-full object-cover object-center" src={asset.url} />
</div>
```

Đây vẫn là một **khai báo trước khi vẽ** — chỉ khác là con số về cùng dữ liệu thay vì nằm trong
mã. Nó không phải `RATIO-0`, vì `RATIO-0` đòi kích thước đã có mặt từ lúc viết mã.

### Trường hợp: bản ghi thiếu kích thước — rơi về một mã đã khai, không rơi về hư không

```tsx
<div
  className={asset.width && asset.height ? "w-full overflow-hidden rounded-lg bg-neutral-100" : "aspect-[4/3] w-full overflow-hidden rounded-lg bg-neutral-100"}
  style={asset.width && asset.height ? { aspectRatio: `${asset.width} / ${asset.height}` } : undefined}
>
  <img alt={asset.alt} className="size-full object-cover object-center" src={asset.url} />
</div>
```

### Ngoại lệ và nhầm lẫn

- **Đừng viết lại tỉ lệ đã có tên:**

  ```tsx
  {/* SAI */}  <div className="aspect-[16/9]">…</div>
  {/* ĐÚNG */} <div className="aspect-video">…</div>
  ```

  ```tsx
  {/* SAI */}  <div className="aspect-[1/1]">…</div>
  {/* ĐÚNG */} <div className="aspect-square">…</div>
  ```

- **Con số phải viết một lần cho một loại khung.** Cùng một loại thẻ mà chỗ này `aspect-[3/1]`, chỗ
  kia `aspect-[16/5]` là hai quyết định cho một sự thật.
- **Không đoán tỉ lệ từ tấm ảnh đang nhìn thấy.** `RATIO-4` là quyết định của sản phẩm hoặc con số của
  dữ liệu; con số của một tấm ảnh mẫu không phải cả hai.

---

## `RATIO-5` — hình dạng của nguồn chính là nội dung

### Trường hợp: ảnh chụp màn hình đính kèm trong một báo lỗi

```tsx
<div className="grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-lg border bg-neutral-50">
  <img
    alt="Ảnh chụp màn hình do người dùng gửi"
    className="max-h-full max-w-full object-contain"
    src={attachment.url}
  />
</div>
```

Khung vẫn khai `aspect-[4/3]` — nhưng khai để **giữ chỗ**, không phải để cắt. Chính cặp *khung có
chặn + `object-contain`* làm nên `RATIO-5`, chứ không phải con số 4:3.

### Trường hợp: dải biểu trưng đối tác — chặn bằng chiều cao

```tsx
<ul className="flex flex-wrap items-center gap-8">
  {partners.map((partner) => (
    <li className="flex h-12 items-center" key={partner.id}>
      <img
        alt={partner.name}
        className="h-full w-auto max-w-40 object-contain"
        src={partner.logoUrl}
      />
    </li>
  ))}
</ul>
```

Chiều cao là cái chặn, hình dạng vẫn thuộc về nguồn. Biểu trưng rộng và biểu trưng vuông đứng chung một hàng mà
không cái nào bị xén chữ.

### Trường hợp: biểu đồ xuất ra dạng ảnh

```tsx
<figure className="flex flex-col gap-2">
  <div className="grid aspect-video w-full place-items-center overflow-hidden rounded-lg border bg-white">
    <img alt="Biểu đồ doanh thu theo quý" className="max-h-full max-w-full object-contain" src={chart.url} />
  </div>
  <figcaption className="text-sm text-neutral-500">Doanh thu theo quý</figcaption>
</figure>
```

Cắt một biểu đồ là cắt mất trục. Không có bố cục nào đẹp đủ để bù cho việc đó.

### Trường hợp: bản xem trước tệp đính kèm trong hội thoại

```tsx
<div className="grid aspect-square w-48 place-items-center overflow-hidden rounded-lg border bg-neutral-50">
  <img alt={file.name} className="max-h-full max-w-full object-contain p-2" src={file.previewUrl} />
</div>
```

### Trường hợp: chữ ký trên nền trong suốt

```tsx
<div className="grid h-24 w-full place-items-center rounded-md border bg-white">
  <img alt="Chữ ký" className="max-h-full max-w-full object-contain" src={signature.url} />
</div>
```

### Trường hợp: từ chối khung cho tới khi đo được

```tsx
{asset.width && asset.height ? (
  <div
    className="w-full overflow-hidden rounded-lg bg-neutral-100"
    style={{ aspectRatio: `${asset.width} / ${asset.height}` }}
  >
    <img alt={asset.alt} className="size-full object-contain" src={asset.url} />
  </div>
) : (
  <div className="grid aspect-[4/3] w-full place-items-center rounded-lg border bg-neutral-50 text-sm text-neutral-500">
    Đang chuẩn bị bản xem trước
  </div>
)}
```

Nhánh thứ hai **không** phải một khung rỗng để chờ ảnh nhảy vào; nó là một trạng thái có nội dung,
cùng hình dạng với trạng thái sau đó.

### Ngoại lệ và nhầm lẫn

- **`object-contain` mà không có chặn là chưa khai gì.** Khung sẽ co lại về 0 rồi bung ra khi ảnh về:

  ```tsx
  {/* SAI */}  <img className="w-full object-contain" src={attachment.url} />
  ```

- **`object-cover` ở đây luôn sai**, kể cả khi bố cục nhìn gọn hơn:

  ```tsx
  {/* SAI — xén mất cột bên phải của ảnh chụp màn hình */}
  <div className="aspect-video overflow-hidden">
    <img className="size-full object-cover" src={attachment.url} />
  </div>
  ```

- **Nền là một phần của mã này.** Phần thừa phải nhìn ra là phần thừa cố ý, không phải một lỗ trống
  của trang. `bg-neutral-50` hay `bg-white` là quyết định, không phải trang trí.
- **Đừng dùng `RATIO-5` cho ảnh sản phẩm chụp studio.** Ở đó rìa ảnh không mang nghĩa, và một lưới
  thêm dải trống trông như một lưới hỏng ⇒ `RATIO-1` hoặc `RATIO-3`.

---

## Mã lồng mã

### Trường hợp: thẻ khoá học — bốn mã trong một cây

```tsx
<article className="flex flex-col gap-3 rounded-lg border p-4">
  <div className="aspect-video w-full overflow-hidden rounded-md bg-neutral-100">
    <img alt="" className="size-full object-cover object-center" src={course.thumbnailUrl} />
  </div>
  <div className="flex flex-col gap-1">
    <h3 className="font-medium">{course.title}</h3>
    <p className="text-sm text-neutral-500">{course.summary}</p>
  </div>
  <div className="flex items-center gap-2">
    <span className="size-8 shrink-0 overflow-hidden rounded-full bg-neutral-100">
      <img alt="" className="size-full object-cover object-center" src={course.author.avatarUrl} />
    </span>
    <span className="text-sm">{course.author.name}</span>
    <svg aria-hidden="true" className="ml-auto size-4 text-neutral-400" viewBox="0 0 16 16" />
  </div>
</article>
```

Ảnh thu nhỏ là `RATIO-2` vì nó thay mặt cho một bài giảng có thời lượng. Ảnh đại diện là `RATIO-1` vì mọi
ảnh đại diện trong sản phẩm phải khớp nhau. Biểu tượng cuối hàng là `RATIO-0` vì `viewBox` đã mang tỉ lệ.
**Mã áp cho một khung, không áp cho cả cây.**

### Trường hợp: trang chi tiết — ảnh chính và dải ảnh nhỏ

```tsx
<div className="flex flex-col gap-3">
  <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-neutral-100">
    <img alt="" className="size-full object-cover object-center" src={item.photos[0].url} />
  </div>
  <ul className="grid grid-cols-5 gap-2">
    {item.photos.map((photo) => (
      <li className="aspect-square overflow-hidden rounded-md bg-neutral-100" key={photo.id}>
        <img alt="" className="size-full object-cover object-center" src={photo.url} />
      </li>
    ))}
  </ul>
</div>
```

Cùng một tập ảnh, hai mã khác nhau, vì hai khung thay mặt cho hai việc khác nhau: khung lớn để
**xem**, dải nhỏ để **chọn**.

### Trường hợp: một bản ghi hỗ trợ — `RATIO-1` bọc ngoài, `RATIO-5` bên trong

```tsx
<article className="flex flex-col gap-3 rounded-lg border p-4">
  <header className="flex items-center gap-2">
    <span className="size-8 shrink-0 overflow-hidden rounded-full bg-neutral-100">
      <img alt="" className="size-full object-cover object-center" src={ticket.reporter.avatarUrl} />
    </span>
    <strong className="text-sm">{ticket.reporter.name}</strong>
  </header>
  <p className="text-sm">{ticket.message}</p>
  <div className="grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-md border bg-neutral-50">
    <img alt="Ảnh chụp màn hình đính kèm" className="max-h-full max-w-full object-contain" src={ticket.screenshotUrl} />
  </div>
</article>
```

Ảnh đại diện được cắt vì các ảnh đại diện phải khớp nhau; ảnh chụp màn hình thì không, vì nó là **bằng chứng**.
Hai mã đứng cách nhau ba dòng và không cái nào kéo cái nào theo.

### Trường hợp: art hướng — đổi mã theo vai trò bố cục

```tsx
<div className="aspect-square w-full overflow-hidden rounded-lg bg-neutral-100 md:aspect-[3/1]">
  <img alt="" className="size-full object-cover object-center" src={campaign.heroUrl} />
</div>
```

`RATIO-1` trên màn hẹp, `RATIO-4` từ `md` trở lên. Hợp lệ vì vai trò bố cục thật sự đổi: một ô trong
dòng chảy dọc, và một băng ngang trải hết bề rộng. `fit` **không** đổi theo — nếu phải đổi cả `fit`
thì đây là hai tình huống khác nhau chứ không phải một art hướng.

---

## Ánh xạ yêu cầu sang một cặp khung-và-cách khớp

Nêu cái khung, tình trạng kích thước của nguồn, và điều mà một cú cắt sẽ lấy đi. Nếu thiếu **một** dữ
kiện quyết định, hỏi **một** câu cụ thể rồi dừng. Câu trả lời phải là một cặp class CSS hoặc một câu hỏi
— không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Hiện ảnh đại diện tròn cạnh tên người dùng | Các ảnh đại diện phải khớp nhau; rìa ảnh không mang nghĩa | `RATIO-1` | `size-10 overflow-hidden rounded-full` + `size-full object-cover object-center` |
| Dựng ảnh thu nhỏ cho một bài giảng có video | Khung thay mặt cho nội dung động | `RATIO-2` | `aspect-video overflow-hidden` + `size-full object-cover object-center` |
| Nhúng video của một nền tảng khác | Khung vẫn của mình dù nội dung thì không | `RATIO-2` | `aspect-video overflow-hidden` + `absolute inset-0 size-full` |
| Đặt ảnh bìa cho thẻ bài viết | Ảnh chụp, chủ thể cần chiều cao | `RATIO-3` | `aspect-[4/3] overflow-hidden` + `size-full object-cover object-center` |
| Dựng băng khuyến mãi trải hết bề ngang | Tỉ lệ do sản phẩm đặt, không có tên sẵn | `RATIO-4` | `aspect-[3/1] overflow-hidden` + `size-full object-cover object-center` |
| Hiện ảnh người dùng tải lên, dữ liệu có sẵn `width`/`height` | Tỉ lệ khai được trước khi vẽ, theo bản ghi | `RATIO-4` | `style={{ aspectRatio }}` + `size-full object-cover object-center` |
| Hiện ảnh chụp màn hình đính kèm trong báo lỗi | Bốn cạnh đều mang nghĩa; cắt là mất bằng chứng | `RATIO-5` | `aspect-[4/3] grid place-items-center bg-neutral-50` + `max-h-full max-w-full object-contain` |
| Xếp một hàng biểu trưng đối tác | Hình dạng thuộc về nguồn; chặn bằng chiều cao | `RATIO-5` | `flex h-12 items-center` + `h-full w-auto object-contain` |
| Chèn sơ đồ tĩnh đã biết kích thước vào bài viết | Chỗ đã được giữ bởi chính con số của nguồn | `RATIO-0` | `w-full h-auto` + `width`/`height` thật |
| Hiện ảnh trong lưới, chưa nói ảnh chụp hay ảnh chụp màn hình | Chưa chứng minh được rìa ảnh mang nghĩa ⇒ chọn mã cắt ít hơn | `RATIO-3` | `aspect-[4/3] overflow-hidden` + `size-full object-cover object-center` |

Ở dòng cuối, câu hỏi phân định **chỉ** được hỏi khi bên yêu cầu nói rõ họ cần hình dạng cắt nhiều
hơn: *"Cắt mất rìa của tấm này thì người đọc có mất thông tin họ đến để xem không?"*

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `RATIO-0` / mọi mã khác | Kích thước thật đã có mặt trong mã đánh dấu trước khi tải chưa? |
| `RATIO-0` / `RATIO-4` | Con số nằm sẵn trong mã, hay về cùng dữ liệu? |
| `RATIO-1` / `RATIO-3` | Hình dạng do hàng xóm quyết định, hay do chủ thể trong ảnh? |
| `RATIO-2` / `RATIO-3` | Khung thay mặt cho nội dung động, hay cho một tấm ảnh? |
| `RATIO-2` / `RATIO-4` | Rộng vì là nội dung động, hay rộng vì sản phẩm muốn một băng ngang? |
| `RATIO-4` / mọi mã có tên | Con số này có trùng 1:1, 16:9 hay 4:3 không? |
| `RATIO-5` / `RATIO-1`…`RATIO-4` | Cắt tấm này thì người đọc có phải mở bản gốc mới hiểu không? |

## Sai lầm lặp lại nhiều nhất

1. Không khai tỉ lệ, rồi gọi cú nhảy bố cục là "ảnh tải chậm".
2. Coi `RATIO-0` là mặc định, trong khi không có `width`/`height` nào để làm bằng chứng.
3. Khai khung mà quên khai `fit` — hình dạng đúng, ảnh méo.
4. Cắt mà không nói cắt từ đâu, rồi mọi ảnh chân dung đều mất đầu.
5. Đặt tỉ lệ lên cả khung lẫn `<img>`, hoặc đặt tỉ lệ cạnh chiều cao cố định.
6. `object-cover` cho ảnh chụp màn hình, biểu đồ và biểu trưng — cắt mất chính thứ người đọc cần.
7. `object-contain` mà không có chặn, nên khung vẫn nhảy đúng như khi không khai gì.
8. Khung chờ dùng khung khác trạng thái đã tải, biến chính cái khung chờ thành nguồn của cú nhảy.
9. Đổi tỉ lệ theo từng tấm ảnh bằng một cờ đoán ra, thay vì khai theo `width`/`height` của dữ liệu.
10. Viết `aspect-[16/9]` và `aspect-[1/1]` thay cho `aspect-video` và `aspect-square`.
