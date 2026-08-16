---
id: fe-patterns-contract-vi
title: vi.md
slug: /fe/patterns/contract/vi
sidebar_label: vi.md
sidebar_position: 1
description: Các tình huống CONTRACT-N, nhận diện bằng nghiệp vụ chứ không bằng mắt.
---

# vi.md

> Version: `2.00` · Module: `contract`

# Contract

Contract là mô tả của **một node**. Nó là một **key**, và key sở hữu ba thứ mà tách ra thì cả ba đều
vô nghĩa: **class** mà node mặc, **element** mà node mở ra, và **lý do** những thứ bên trong nó lại
đứng như vậy.

Người viết cần một hình dạng thì gõ key. Đó là **toàn bộ** quyết định layout mà họ được phép ra.

Câu hỏi phân định duy nhất:

> Element này có **chứa** element khác không?

Có ⇒ nó là node ⇒ node đến từ một key. Một file tự mở `div` là một file đã tự trả lời câu hỏi mà bảng
contract sinh ra để trả lời.

**Đây là luật bắt buộc.** Mọi element cấu trúc đi vào production đều rơi vào đúng một mã dưới đây.
Không có hình dạng nào nhỏ tới mức được miễn: một hàng hai con là `CONTRACT-1` cũng vì lý do đó mà một
page shell là `CONTRACT-1`. Câu "có mỗi cái wrapper thôi mà" là chỗ luật này bị bỏ qua nhiều nhất.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Tầng giữ |
|---|---|---|
| `CONTRACT-1` | Đang định gõ `flex gap-3` thẳng vào một file | `enforced` |
| `CONTRACT-2` | Có hai trạng thái, định ghép class lúc chạy để phân biệt | `enforced` |
| `CONTRACT-3` | Cần một giá trị khoảng cách/căn lề chưa có trong bảng từ vựng | `unrepresentable` |
| `CONTRACT-4` | Node cần là `ul`, `form`, `main` — không phải `div` | `enforced` |
| `CONTRACT-5` | Đang đặt tên cho một key mới | `documented` |
| `CONTRACT-6` | Đang viết `why` cho một entry | `enforced` |
| `CONTRACT-7` | Đang mở một thẻ bằng tay ở ngoài frame | `enforced` |
| `CONTRACT-8` | Đang viết tay `data-node` / `data-why` | `enforced` |
| `CONTRACT-9` | Định thêm key vì key cũ "hơi chật" | `enforced` |
| `CONTRACT-10` | Cần bọc node trong một vendor wrapper cố định | `documented` |
| `CONTRACT-11` | Đang khai báo bên trong một entry có gì | `unrepresentable` |
| `CONTRACT-12` | Entry đang muốn mang `cursor-pointer`, `bg-surface`, `shadow-*` | `enforced` |
| `CONTRACT-13` | Có key trong bảng mà không màn nào vẽ | `enforced` |

---

## `CONTRACT-1` — class cấu trúc đến từ key, không từ literal

**Tình huống.** Bạn đang ở trong một block, một page hoặc một composite, và cần hai thứ đứng cạnh
nhau. Tay bạn định gõ `className="flex items-center gap-3"`.

`flex`, `grid`, `gap-*`, `items-*`, `justify-*`, `col-*`, họ `position` — chúng quyết định **hình
dạng của một cây**, không phải vẻ ngoài của một giá trị. Một hình dạng được quyết ở call site là một
hình dạng không ai tìm ra được từ bất cứ chỗ nào khác.

**Dấu hiệu nhận biết**

- Chuỗi class có ít nhất một token thuộc họ cấu trúc.
- Element đang mở ra để **chứa** thứ khác, không phải để hiển thị một giá trị.
- Bạn vừa nhấc chuỗi class lên thành hằng số module để "cho gọn".

**Tự hỏi.** Nếu ngày mai cần biết node này rộng bao nhiêu và các con xếp thế nào, tôi tra ở đâu? Nếu
câu trả lời là "phải grep", đó là `CONTRACT-1`.

**Ranh giới**

- ↔ `CONTRACT-2`: `CONTRACT-1` là chuỗi **tĩnh** viết sai chỗ; `CONTRACT-2` là chuỗi được **ghép lúc
  chạy**. Hai lỗi khác nhau, hai cách sửa khác nhau.
- ↔ `CONTRACT-3`: `CONTRACT-1` hỏi *ai được viết class này*; `CONTRACT-3` hỏi *class này có tồn tại
  không*. Một `gap-[13px]` viết trong bảng vẫn sai, nhưng sai vì `CONTRACT-3`.
- ↔ `CONTRACT-7`: nếu bạn vừa mở cả một `div` mới thì đó là `CONTRACT-7`; `CONTRACT-1` áp cho class
  trên một element bạn đã có quyền mở.

**Nhấc lên hằng số không cứu được gì.** `const ROW = "flex items-center gap-3"` chỉ đẩy quyết định lên
một dòng, và làm nó **vô hình** với cả người đọc bảng lẫn mọi rule đọc JSX.

**Tình huống nghiệp vụ hay gặp.** Hàng avatar + tên · lưới thẻ khoá học · toolbar lọc · cột trái của
trang chi tiết · footer của một form · thanh hành động dính đáy trên mobile.

---

## `CONTRACT-2` — không ghép chuỗi class lúc chạy

**Tình huống.** Có hai trạng thái thật (`isCompact`, `isSelected`, `variant`), và bạn định diễn đạt
nó bằng `cn(base, isCompact && "gap-2")` hoặc bằng template string.

**Dấu hiệu nhận biết**

- Có `cn`, `clsx`, `twMerge`, `cva`, `tv` trong file.
- `className={\`... ${x} ...\`}` hoặc `className={a + b}`.
- Có một biến boolean đang chọn giữa hai chuỗi class.

**Tự hỏi.** Sau khi build, có ai đọc được **đầy đủ** chuỗi class mà node này sẽ mặc, mà không cần chạy
component không?

**Ranh giới**

- ↔ `CONTRACT-1`: xem trên.
- ↔ `CONTRACT-9`: khi phân biệt là thật, `CONTRACT-2` bảo *đặt cho nó một cái tên*; `CONTRACT-9` bảo
  *chỉ đặt tên khi hình dạng thật sự khác*. Hai key chỉ khác `gap` là `CONTRACT-9` bác.
- ↔ `CONTRACT-12`: một `cn` chỉ để bật `hover:` là **hai** lỗi: ghép lúc chạy, và hành vi nằm sai chỗ.

**Phân biệt là thật, cách diễn đạt mới sai.** Thứ bạn đang rẽ nhánh là một sự khác biệt có thật trong
nghiệp vụ. Nó xứng đáng có **tên**: hoặc là key thứ hai, hoặc là một prop có tên trên component sở
hữu node.

**Tình huống nghiệp vụ hay gặp.** Row đang chọn/không chọn · card compact/rộng · sidebar thu/mở ·
badge đổi màu theo trạng thái · nút đang loading.

---

## `CONTRACT-3` — từ vựng class là một union đóng

**Tình huống.** Bạn cần một giá trị mà bảng từ vựng chưa có: `gap-[13px]`, `w-[42%]`, `items-stretch`.

**Dấu hiệu nhận biết**

- TypeScript báo đỏ ngay tại phần tử trong mảng `classes`.
- Bạn đang định thêm `as string` hoặc `as LayoutClassName` để cho qua.

**Tự hỏi.** Giá trị này là **một bậc mới của hệ**, hay chỉ là một lần chỉnh cho vừa mắt ở đúng một
màn hình?

**Ranh giới**

- ↔ `CONTRACT-1`: `CONTRACT-1` nói ai được viết; `CONTRACT-3` nói viết được cái gì.
- ↔ `CONTRACT-9`: `CONTRACT-3` mở rộng **từ vựng class**; `CONTRACT-9` mở rộng **từ vựng key**. Cả hai
  đều là lạm phát, nhưng ở hai bảng khác nhau.

**Đây là mã mạnh nhất trong module, vì nó không phải một rule.** `gap-[13px]` không bị *cấm*, nó
**không viết ra được**. Không có gì để đi tuần khi giá trị sai không gõ nổi. Thêm một member là một
lần sửa **cố ý** vào một danh sách có tên, không phải một dòng lọt vào diff mà không ai đọc kỹ.

**Tình huống nghiệp vụ hay gặp.** Rail bên phải cần một bề rộng mới · một breakpoint mới · một track
grid mới cho bảng xếp hạng · một inset shadow mới cho verdict band.

---

## `CONTRACT-4` — element thuộc về entry, không thuộc về caller

**Tình huống.** Node này **là** một danh sách, hoặc **là** một form, hoặc **là** landmark chính của
tài liệu. `div` không diễn đạt được điều đó.

**Dấu hiệu nhận biết**

- Bạn đang muốn thêm prop `as` hoặc `host` vào frame.
- Bạn đang định spread node props của một entry lên một element của riêng bạn.
- Assistive technology sẽ đọc sai nếu element bị đổi.

**Tự hỏi.** Nếu hai call site của cùng một key mở ra hai element khác nhau, chúng còn là một node
không? Không — chúng là **hai node mặc chung một cái tên**.

**Ranh giới**

- ↔ `CONTRACT-7`: `CONTRACT-7` nói *đừng tự mở thẻ*; `CONTRACT-4` nói *thẻ nào là quyết định của
  entry*. Một `<ul>` viết tay vi phạm `CONTRACT-7`; một `<ul>` do caller chọn qua prop vi phạm
  `CONTRACT-4`.
- ↔ `CONTRACT-10`: surface branch **được phép** mở wrapper vendor của nó. Cái nó không được làm là
  mặc node của entry lên wrapper đó.

**Đây là lỗi không có màu đỏ ở đâu cả.** Hàm trả node props đưa lại **class và marker, KHÔNG đưa
element**. Spread chúng lên một body vendor thì entry nói `ol` mà tài liệu nhận `div`: danh sách rời
khỏi accessibility tree, không còn gì báo có bao nhiêu mục — trong khi key vẫn resolve, marker vẫn
đọc đúng, và **mọi gate vẫn xanh**. Vậy nên node của entry phải đứng **BÊN TRONG** body vendor, không
phải **TRÊN** nó.

**Lịch sử của mã này đáng nhớ.** Trước khi entry được đặt tên element, frame chỉ vẽ `div`, nên mọi
hình dạng cần `<ul>` **không có chỗ hợp pháp để sống** và bị đẩy xuống tầng leaf — nơi duy nhất được
tự viết class. Cả một tầng đầy lên bằng arrangement vì một chỗ trống.

**Tình huống nghiệp vụ hay gặp.** Chuỗi ngày streak · danh sách module của khoá học · form thanh toán
· landmark `main` của trang · nav đích của sidebar · row của một joined list.

---

## `CONTRACT-5` — TÊN của key cố định thứ nằm bên trong nó

**Tình huống.** Bạn vừa dựng xong một node và phải đặt tên cho nó.

**Dấu hiệu nhận biết**

- Cái tên bạn định đặt là `card`, `box`, `wrapper`, `row`, `container`, `content`.
- Bạn không viết nổi một câu `why` đúng cho **mọi** chỗ sẽ dùng key này.
- Bạn thấy key này "chắc dùng được cho nhiều thứ".

**Tự hỏi.** Nếu ai đó đặt nhầm một đứa con vào key này, người đọc code có **nhìn ra ngay** không?

**Ranh giới**

- ↔ `CONTRACT-6`: tên cố định **cái gì** ở bên trong; `why` nói **vì sao** chúng đứng như vậy. Tên sai
  làm `why` không thể đúng, nên `CONTRACT-5` luôn phải sửa trước.
- ↔ `CONTRACT-11`: entry hợp thành khai báo **từng slot** và compiler kiểm từng cái, nên với entry đó
  cái tên không còn là thứ **duy nhất** giữ đứa con. Với node nhận nội dung từ caller thì tên vẫn là
  thứ duy nhất.
- ↔ `CONTRACT-9`: `CONTRACT-5` hỏi *tên này có cố định được gì không*; `CONTRACT-9` hỏi *key này có
  đáng tồn tại không*.

**Cái tên chung luôn thắng anh em cụ thể của nó** ở mọi call site, vì nó là cái không ai phải suy
nghĩ. Một key vẽ hai mươi vùng thì không nói nổi vì sao **một** vùng nào trong đó lại ở đó.

**Đảo chiều đã được ghi lại, không im lặng.** Bản đồ con từng bị bỏ vì không kiểm được gì khi nội
dung đến dưới dạng markup: một `.map`, một ternary và một subtree vô danh trông y hệt nhau với mọi
rule. Nay nội dung đến dưới dạng **component, một cái cho mỗi slot có tên**, nên phép kiểm không còn
là rule — nó là **type**. Quyết định cũ đúng với hình dạng nó được ra, và sai với hình dạng này.

**Tình huống nghiệp vụ hay gặp.** `label-figure-over-bar` · `title-with-baseline-fact` ·
`page-header-stack` · `weekday-run` — và những cái tên **không** được dùng: `card`, `section-inner`,
`main-wrapper`.

---

## `CONTRACT-6` — mỗi entry nói vì sao node của nó tồn tại

**Tình huống.** Bạn đang điền trường `why` của một entry.

**Dấu hiệu nhận biết**

- Câu `why` đọc lên chỉ là cái key viết thành chữ thường có dấu cách.
- Câu `why` ngắn hơn một mệnh đề.
- Bỏ node đi, câu `why` vẫn "đúng" — vì nó không nói gì cả.

**Tự hỏi.** Nếu xoá node này, cái gì **vỡ, xuống dòng, tràn ra, hoặc thôi bấm được**? Viết đúng cái đó.

**Ranh giới**

- ↔ `CONTRACT-5`: xem trên.
- ↔ `CONTRACT-12`: nếu lý do thật là "để nó bấm được" thì đó không phải lý do của một entry — đó là
  `CONTRACT-12`, và hành vi phải chuyển sang branch sở hữu control.

**Đây là thứ duy nhất không tái tạo được từ markup về sau.** Class đọc lại được, element đọc lại được,
danh sách con đọc lại được. Cái **không** đọc lại được là vì sao ai đó đã dựng node này. "Một hàng
chip" tốn một dòng và không dạy gì; "tag xuống dòng riêng trước khi tiêu đề xuống dòng" là sự thật đã
làm node ra đời.

**Tình huống nghiệp vụ hay gặp.** Vì sao fact dính baseline với tiêu đề · vì sao rail phải sticky · vì
sao total tách khỏi các dòng phía trên bằng một đường kẻ · vì sao thumbnail bị ẩn trên màn hẹp.

---

## `CONTRACT-7` — đúng một file biến key thành element

**Tình huống.** Bạn cần một hộp. Không có key nào vừa.

**Dấu hiệu nhận biết**

- Bạn vừa gõ `<div>`, `<section>`, `<main>`, `<header>`, `<footer>`, `<aside>`, `<nav>` ở ngoài frame.
- Bạn vừa gắn `className` lên một `<ul>`, `<ol>`, `<li>`, `<form>`.

**Tự hỏi.** Cái hộp này có ghi lại được ở đâu không: nó mặc class gì, đứa con nào thuộc về nó, và nó
tồn tại vì cái gì? Nếu không có chỗ nào ghi, đó là node không key.

**Ranh giới**

- ↔ `CONTRACT-1`: một element không key mà **không** mang class cấu trúc vẫn là `CONTRACT-7`. Hai mã
  bắt hai nửa khác nhau của cùng một thói quen.
- ↔ `CONTRACT-4`: xem trên.
- ↔ `CONTRACT-10`: surface branch có tên là **ngoại lệ đã đóng** của mã này.

**Element ngữ nghĩa là chuyện khác, và khác đó không phải kẽ hở.** `form` tồn tại để submit; `ul` tồn
tại vì nội dung của nó là một danh sách. Assistive technology đọc chính cái element đó, nên nó không
thể bị thay bằng một hộp trung tính, và mở nó quanh một contract node **không quyết định hình dạng
nào cả**. Thứ vẫn phải đến từ entry là **HÌNH DẠNG**: ngay khi element ngữ nghĩa mang một class, nó
thôi làm wrapper và trở thành node không key.

**Không có key nào vừa thì đó là phát hiện.** Nó không phải lý do để mở `div`.

**Tình huống nghiệp vụ hay gặp.** Wrapper "cho dễ căn" · `section` bọc nội dung trang · `div` giữ chỗ
trong lúc loading · `form` có `onSubmit` và không class nào — cái cuối là hợp lệ.

---

## `CONTRACT-8` — marker do frame vẽ, không viết tay

**Tình huống.** Bạn muốn một element đọc lên như "thuộc về contract" cho test hoặc cho công cụ.

**Dấu hiệu nhận biết**

- Có `data-node="..."` hoặc `data-why="..."` viết tay trong source sản phẩm.

**Tự hỏi.** Cái marker này đang **báo cáo** một entry, hay đang **khẳng định** một entry mà không có
gì giữ?

**Ranh giới**

- ↔ `CONTRACT-4`: `CONTRACT-4` là spread cả cụm node props lên element sai; `CONTRACT-8` là gõ tay
  từng attribute. Kết quả giống nhau ở chỗ tệ nhất: node đọc lên như có contract mà không có.

**Marker viết tay tệ hơn node không marker.** Node không marker ít nhất **thành thật**. Node có marker
viết tay khiến mọi người đọc và mọi test đi qua các attribute đó tin vào một lời khẳng định mà không
rule nào giữ.

**Tình huống nghiệp vụ hay gặp.** Thêm `data-node` để selector trong e2e ngắn lại · copy một node đã
render rồi dán vào chỗ khác · fixture của story bị nhấc thành component thật.

---

## `CONTRACT-9` — key mới được biện minh bằng hình dạng, không bằng một cái gap khác

**Tình huống.** Có key gần đúng, chỉ là "hơi chật" hoặc "hơi thưa".

**Dấu hiệu nhận biết**

- Key mới khác key cũ đúng một token khoảng cách.
- Key mới khác key cũ đúng một `restingCount`.
- Key mới chỉ khác ở `why` và ở tên.

**Tự hỏi.** Trừ cái tên, cái lý do và số placeholder ra, hai entry này còn khác nhau ở đâu? Nếu không
còn gì, chúng là **một** entry dưới hai cái tên.

**Ranh giới**

- ↔ `CONTRACT-3`: xem trên.
- ↔ `CONTRACT-13`: `CONTRACT-9` chặn key **thừa lúc sinh**; `CONTRACT-13` xoá key **đã chết**.
- ↔ `CONTRACT-2`: xem trên.

**Từ vựng phình lên theo từng call site** cho tới khi các key mô tả **call site** chứ không mô tả
**hình dạng**, và danh sách dài hơn cả đoạn code đọc nó. Muốn hình dạng cũ chặt hơn thì đổi entry cho
**tất cả**, hoặc dùng đúng cái đang có.

**Tình huống nghiệp vụ hay gặp.** "Cái này giống card kia nhưng thưa hơn" · "cần đúng cái đó nhưng
loading 4 dòng thay vì 3" · "y hệt nhưng dùng ở trang khác".

---

## `CONTRACT-10` — contract cố định nội dung; branch sở hữu cơ chế wrapper

**Tình huống.** Nội dung đã có contract, nhưng nó phải nằm trong một vendor wrapper cố định: thân
card, thân accordion, thân list.

**Dấu hiệu nhận biết**

- Bạn định tạo key cho dòng tiêu đề, cho wrapper ngoài và cho caption chỉ để khỏi phải viết branch.
- Bạn định tạo một bảng "compound" mô hình hoá `Card > Card.Content`.
- Bạn định spread node props lên `Card.Content`.

**Tự hỏi.** Cái seam này có **biến đổi theo caller** không? Nó có **nhận con** không? Nếu cả hai đều
không, nó là cơ chế của branch, không phải một từ vựng thứ hai.

**Ranh giới**

- ↔ `CONTRACT-7`: surface branch có tên là ngoại lệ của `CONTRACT-7`; mọi branch khác thì không.
- ↔ `CONTRACT-4`: contract node đứng **bên trong** content host, không **trên** nó. Đây là chỗ hai mã
  gặp nhau và là chỗ sai nhiều nhất.
- ↔ `CONTRACT-11`: quan hệ giữa các row **ngang hàng** thuộc về root contract, không thuộc về wrapper.

**Vì sao không có bảng compound.** Lặp lại `Card > Card.Content` chỉ tốn hai dòng; trích nó ra thêm
một lớp gián tiếp mà **không sở hữu chính sách nào**. Ngược lại, tạo key cho heading line, wrapper
ngoài và caption sẽ biến **một** host thành **ba** contract.

**Tình huống nghiệp vụ hay gặp.** Card có tiêu đề ngoài và caption dưới · accordion có body cuộn ·
joined list nằm trong card `p-0` · form card có footer hành động cố định.

---

## `CONTRACT-11` — entry khai báo mọi slot bên trong, và mỗi slot có tên

**Tình huống.** Bạn đang nói cho entry biết bên trong nó có gì.

**Dấu hiệu nhận biết**

- Bạn định dùng `children` theo nghĩa React.
- Bạn định truyền một mảng con **theo thứ tự**.
- Bạn định viết một arrow trực tiếp vào một slot.
- Bạn có slot lặp mà không nói bao nhiêu placeholder vẽ lúc chờ.

**Tự hỏi.** Nếu ngày mai ai đó chèn thêm một đứa con vào **giữa**, có gì bị đổi nghĩa trong im lặng
không?

**Ranh giới**

- ↔ `CONTRACT-5`: xem trên.
- ↔ `CONTRACT-10`: `divide-y` ngồi trên content host; row leaf **không** tự vẽ luật `after` và không
  soi `last-child`.
- ↔ `CONTRACT-12`: `props` trong slot là **ràng buộc literal**, không phải giá trị bơm lúc chạy. Chữ
  do query trả về đi qua `props` runtime của render component và **không bao giờ** vào bảng.

**Slot có TÊN, không ĐẾM.** Chèn một đứa con vào danh sách theo vị trí thì mọi vị trí sau nó âm thầm
mang nghĩa khác; một cái tên sống sót qua lần chèn đó, đọc được ngay tại call site mà không phải đếm,
và cho `why` một thứ để nhắc đến.

**`repeats: true` nói slot lúc sống là mảng; `restingCount` nói lúc chờ vẽ bao nhiêu placeholder.** Độ
dài thật là động, nên không được lẫn với số skeleton. Cặp này bắt buộc đi cùng nhau: không có
`restingCount` trên slot vô hướng, và không có slot lặp nào để trống hình dạng lúc nghỉ.

**Với joined list.** Quan hệ giữa các row ngang hàng thuộc về root contract. Tên miền nghiệp vụ của
tập hợp (`tasks`, `courses`, `alerts`) là **field trong kiểu props có tên** của content component;
một slot chung tên `items` sẽ dạy cho surface biết mô hình dữ liệu của caller và không thuộc từ vựng
branch. Root của joined list là `p-0`, row là con trực tiếp, nên mọi divider chạm được hai mép. Row
contract trả lại lề `p-4` của card một cách **bất đối xứng**: một row `p-4`; row đầu `px-4 pt-4 pb-3`;
row giữa `px-4 py-3`; row cuối `px-4 pt-3 pb-4`. Cụm label/surface/caption cố định chứa các đơn vị
sở-hữu-và-được-sở-hữu nên dùng `gap-3`.

**List host cũng sở hữu fact tuỳ chọn ở cuối dòng label.** Fact đó là `xs muted` đứng cạnh label `sm
semibold` và **định tính cho chính joined list**. Nó không được caller chiếu ra thành sibling riêng,
và không được nhét vào `description`: `description` dành cho caption của cả list, nằm dưới surface.

**Đây không phải `children` của React, và chính điều đó làm nó kiểm được.** Markup đến nơi thì đã dựng
xong và đã xoá mất hình dạng của chính nó. Sai key, sai props, sai identity, sai số lượng, thiếu slot
và thừa slot đều là **lỗi biên dịch**.

**Tình huống nghiệp vụ hay gặp.** Danh sách quest hằng ngày · lưới thẻ khoá học · bảng xếp hạng · danh
sách module có skeleton · dòng label có fact đứng cuối.

---

## `CONTRACT-12` — class của entry là SẮP XẾP, không phải hành vi và không phải sơn

**Tình huống.** Node cần bấm được, hoặc cần nền, hoặc cần đổ bóng.

**Dấu hiệu nhận biết**

- Entry mang `cursor-*`, `hover:*`, `active:*`, `focus:*`, `group`.
- Entry mang màu chữ, `underline`, `decoration-*`.
- Entry mang `bg-surface*` hoặc `shadow-*`.

**Tự hỏi.** Class này nói **các con đứng với nhau thế nào**, hay nói **node này phản ứng ra sao / trông
như cái gì**?

**Ranh giới**

- ↔ `CONTRACT-6`: xem trên.
- ↔ `CONTRACT-10`: surface là một **COMPONENT**, không phải một danh sách class. Entry vẽ nền và bóng
  là cách thứ hai để làm ra thứ đã có chủ.
- ↔ `CONTRACT-3`: union hiện vẫn **chứa** vài token thuộc họ này. Đó là nợ đã đo được, không phải giấy
  phép; xem `audit.md`.

**Hai chủ cho một lời hứa.** Node mà entry cho `cursor-pointer` + `hover:opacity-80` đang **tự nhận là
bấm được**, trong khi thứ thật sự bấm — nút, link, control giữ handler và trạng thái disabled — nằm ở
chỗ khác hẳn. Bảng là bên **không thể được báo** rằng lời hứa đã tắt: entry không biết call site này
không truyền handler, nên nó cứ vẽ con trỏ lên một thứ chết.

**Nền và độ nổi thì có hậu quả riêng.** Bảng sẽ chứa **hai loại card** — một loại do branch vẽ, một
loại do key vẽ — và không key nào nói cho ai biết họ đang nhìn loại nào. Người sau với lấy cái gần
tay hơn, và hôm surface của nhà đổi radius hoặc đổi elevation, chỉ **một** trong hai loại đổi theo.

**Một dải (band) là ngoại lệ đã đóng.** Nền đơn thuần chưa làm nên vật thể nổi: một landing page có
các section đổi nền để đếm được vẫn không phải card. Dải chạy **hết bề ngang và tự kẻ ranh giới với
dải kế tiếp**; vật thể thì dừng trước mép và được bao bởi chính nó.

**Tình huống nghiệp vụ hay gặp.** Row bấm được trong danh sách · card có hover · section landing đổi
nền · hàng có shadow riêng bên trong một card đã có shadow.

---

## `CONTRACT-13` — key không ai vẽ thì không phải từ vựng

**Tình huống.** Trong bảng có key mà không màn nào render.

**Dấu hiệu nhận biết**

- Không `contract="key"`, không `defineContractComponent("key")`, không slot nào của entry khác gọi.
- Key được thêm "để tuần sau dùng".
- Key sống sót qua một đợt đổi tên mà không ai chạm.

**Tự hỏi.** Có màn hình nào đang đứng trong tài liệu nhờ key này không?

**Ranh giới**

- ↔ `CONTRACT-9`: xem trên.
- ↔ `CONTRACT-5`: một key chết vì tên nó quá chung nên không ai với tới cũng là `CONTRACT-5` chưa được
  sửa.

**Key chết không nằm yên.** Nó sống qua mọi lần đổi tên, vì đổi tên đi theo call site và nó không có
call site nào. Nó được chép nguyên vào repository kế tiếp, vì bảng đi cả cụm và không có gì trong bảng
nói member nào từng được vẽ. Và nó làm bảng dài hơn đoạn code đọc bảng — tới lúc đó người đọc thôi tin
bảng là mô tả của sản phẩm.

**Chỗ đúng của một hình dạng chưa dựng là plan record**, nơi một node chưa tồn tại đúng là thứ người
đọc mong gặp; không phải bảng từ vựng, nơi mọi thứ có mặt đều được hiểu là đang trên màn hình.

**Tình huống nghiệp vụ hay gặp.** Key còn lại sau khi một trang bị gỡ · key sinh ra từ một bản preview
chưa được duyệt · key copy sang repository mới cùng cả bảng.

---

## Luật

1. Element có chứa element khác ⇒ nó là node ⇒ node đến từ một key.
2. Class cấu trúc chỉ được viết trong bảng entry.
3. Không ghép, không nội suy chuỗi class lúc chạy.
4. Mọi giá trị class là member của union đóng.
5. Element do entry đặt tên; chỉ frame được mặc nó.
6. Đúng **một** file biến key thành element.
7. Marker do frame vẽ.
8. Mỗi slot có tên; không đứa con nào được với tới bằng cách đếm.
9. Slot lặp luôn khai `restingCount`; slot vô hướng không bao giờ khai.
10. Hai entry không được đánh vần **một** hình dạng dưới hai cái tên.
11. Class của entry là sắp xếp, không phải hành vi, sơn hay vật thể.
12. Mọi key trong bảng đều được vẽ ở đâu đó.
13. Tên của key cố định thứ được phép nằm bên trong nó.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã
nó áp vào.

- **Tầng leaf sở hữu ruột của chính nó.** `CONTRACT-1`, `CONTRACT-7`. Leaf bọc **một** primitive
  vendor và viết đúng phần keo giữ một dòng lại với nhau. Ngoại lệ này là một **THƯ MỤC**, nên nó là
  ranh giới chính sách chứ không phải một type: ai cũng thoát được bằng cách nộp file vào đó. Thứ giữ
  một vùng ở ngoài là câu hỏi do **người** hỏi — file này có sắp xếp hai nội dung không?
- **Surface branch có tên sở hữu wrapper vendor cố định của nó.** `CONTRACT-10`. Seam đó không biến
  đổi theo caller, không nhận con, và không bao giờ nhận marker.
- **Element ngữ nghĩa mở vì NGHĨA và không mang class thì không phải node.** `CONTRACT-7`. Mang một
  class thôi là nó đã thành node không key.
- **Twin test được dựng markup fixture bằng tay.** `CONTRACT-8`. Source sản phẩm thì không, và test tự
  spread node props chỉ chứng minh fixture của chính nó.
- **Plan record mang một bản sao của từ vựng.** `CONTRACT-13`. Bản preview chỉ vẽ đúng trang nó sinh
  ra để trả lời, nên phần lớn bản sao đó không ai vẽ — đó chính là **định nghĩa** của plan record.
