---
id: fe-patterns-landmark-vi
title: vi.md
slug: /fe/patterns/landmark/vi
sidebar_label: vi.md
sidebar_position: 1
description: Các tình huống LANDMARK-N, nhận diện bằng vai trò của file chứ không bằng tên key.
---

# vi.md

> Version: `2.00` · Module: `landmark`

# Landmark

Landmark là nhóm nhỏ các element mà người đọc có thể **nhảy qua lại giữa chúng** mà không cần đọc
những gì nằm bên trong — `main`, `nav`, `aside`, `header`, `footer`.

Chúng **không phải hình dạng**. Một `div` và một `main` bày ra y hệt nhau trên màn hình, và một trong
hai là lý do câu "skip to main content" tồn tại. Vậy nên câu hỏi gốc không bao giờ là "trông thế nào"
mà là:

> Người đọc có được phép nhảy thẳng vào đây không?

**Đây là luật bắt buộc.** Và nó tồn tại vì registry làm cho sai lầm này **im lặng**. Một key tên là
`dashboard-main` ghi lại ý định chính xác đến từng chữ, rồi render ra một `div`, vì cái branch vẽ node
của registry vốn vẽ div. Không có gì đỏ lên cả. Một ứng dụng đã ship đúng như vậy: mọi vùng được đặt
tên đúng, không một landmark nào trong DOM, và không cổng nào có gì để nói.

Câu phải nhớ trước mọi thứ khác:

> **Một cái tên trong key không phải một element trong document.**

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Điều bắt buộc |
|---|---|---|
| `LANDMARK-1` | Cần thêm một loại landmark mới cho màn hình | Một branch cho mỗi element, giống branch thường ở mọi chỗ trừ element nó mở |
| `LANDMARK-2` | Muốn nhét class vào branch landmark cho tiện | Branch chỉ cấp element; class, con và lý do vẫn thuộc về key |
| `LANDMARK-3` | Muốn một branch duy nhất nhận `as="main"` | Element do entry định đoạt, call site không được chọn |
| `LANDMARK-4` | Layout dựng chrome quanh trang được route | Chính layout đó đánh dấu phần trang là landmark |
| `LANDMARK-5` | Một key tên `*-main` nằm sâu trong trang | Chỉ file sở hữu **cả màn hình** mới được mở landmark |

---

## `LANDMARK-1` — mỗi element một branch

**Tình huống.** Màn hình mới cần một `nav` hoặc một `aside` thật, không phải một `div` trông giống
`nav`. Câu hỏi đặt ra là thêm một branch nữa, hay dạy branch sẵn có nhận thêm tham số.

**Dấu hiệu nhận biết**

- Có người vừa nói "thêm một branch nữa thì lặp code quá".
- Đề xuất thay thế luôn là một cờ, một map, hoặc một prop chọn tag.
- Branch mới sẽ giống branch thường **ở mọi dòng** trừ đúng một dòng: element nó mở.

**Tự hỏi.** Nếu tôi thêm branch này, có phải chỉ một file thay đổi không? Nếu đúng, giá của cách làm
đúng đã đủ rẻ để cách làm sai không thắng bằng lý do "tiện hơn".

**Ranh giới**

- ↔ `LANDMARK-3`: `LANDMARK-1` nói **có bao nhiêu branch**; `LANDMARK-3` nói **ai được chọn element**.
  Gộp hai branch lại thành một cái nhận prop là vi phạm cả hai, nhưng vì hai lý do khác nhau.
- ↔ `LANDMARK-2`: branch mới phải giống branch thường **kể cả ở chỗ không sở hữu class**. Nếu nó mọc
  thêm class, nó đã rơi sang `LANDMARK-2`.

**Tình huống nghiệp vụ hay gặp.** Thêm rail điều hướng bên trái · thêm panel phụ trợ cạnh nội dung ·
tách footer thành vùng đọc riêng · dựng thanh công cụ trên cùng của một khu vực.

---

## `LANDMARK-2` — branch không sở hữu class nào

**Tình huống.** Branch landmark vừa ra đời, và ngay lập tức có người muốn cho nó nhận `className`,
`padding`, hoặc "chỉ một cái `min-w-0` thôi".

**Dấu hiệu nhận biết**

- Branch bắt đầu có prop mà key không có tiếng nói.
- Có hai chỗ trả lời được câu "tại sao nút này thụt vào" — key, và branch.
- Không ai còn nói được sự khác nhau giữa branch landmark và registry.

**Tự hỏi.** Nếu ngày mai tôi hỏi *vì sao vùng này rộng chừng ấy*, tôi phải mở mấy file mới trả lời
được? Nhiều hơn một là đã hỏng.

**Ranh giới**

- ↔ `LANDMARK-1`: `LANDMARK-1` cho phép branch **tồn tại**; `LANDMARK-2` giới hạn nó được **mang gì**.
- ↔ `LANDMARK-3`: một class trên branch làm mất **lý do**; một prop chọn element làm mất **ý nghĩa của
  document**. Cái thứ nhất làm layout khó truy, cái thứ hai làm màn hình không nhảy vào được.

**Tình huống nghiệp vụ hay gặp.** "Cho tôi truyền class vào cho nhanh" · vá lệch spacing ngay tại
call site · thêm biến thể `compact` cho landmark · để branch tự quyết `max-width` của trang.

---

## `LANDMARK-3` — element không phải một prop

**Tình huống.** Có đề xuất một branch duy nhất, nhận `as="main"` hoặc `element="nav"`. Nghe rất gọn:
một branch, mọi element.

**Dấu hiệu nhận biết**

- Ý nghĩa của document đứng cùng dòng với các quyết định về giao diện.
- Việc một trang có landmark hay không phụ thuộc vào việc call site có nhớ truyền prop hay không.
- Không có chỗ nào ghi **lý do** trang này mở element ấy.

**Tự hỏi.** Nếu người viết màn hình tiếp theo quên prop này, chuyện gì xảy ra? Nếu câu trả lời là
"trang trông y hệt và không ai nhảy vào được", thì đây không phải một biến thể — đây là một element
khác nghĩa.

**Ranh giới**

- ↔ `LANDMARK-1`: xem trên.
- ↔ `LANDMARK-5`: `LANDMARK-3` nói call site **không được chọn** element; `LANDMARK-5` nói call site
  nào **được phép mang** landmark. Một prop hợp lệ đặt ở đúng file vẫn sai theo `LANDMARK-3`.

**Tình huống nghiệp vụ hay gặp.** Gộp branch cho "đỡ trùng" · design system nhận `as` theo thói quen ·
generic `polymorphic component` · một branch dựng cả `section` lẫn `main` tuỳ hoàn cảnh.

---

## `LANDMARK-4` — layout dựng chrome là người đánh dấu

**Tình huống.** Một layout vẽ điều hướng, rồi vẽ phần trang được route bên cạnh. Chính nó là file
**biết** điều hướng kết thúc ở đâu và trang bắt đầu ở đâu — nên chính nó phải nói ra điều đó.

**Dấu hiệu nhận biết**

- File này vừa dựng chrome, vừa nhận `children` từ router.
- Đọc file này thấy được ranh giới giữa "phần lặp lại ở mọi trang" và "phần người đọc đến để xem".
- Bỏ đánh dấu đi thì bàn phím và trình đọc màn hình phải đi lại toàn bộ navbar sau mỗi lần đổi route.

**Tự hỏi.** File này có biết chỗ nào là hết điều hướng không? Nếu biết, nó là người đánh dấu.

**Ranh giới**

- ↔ `LANDMARK-5`: `LANDMARK-4` bắt một file **phải** đánh dấu; `LANDMARK-5` cấm những file khác đánh
  dấu. Hai vế của cùng một ý, và chúng có tập file khác nhau.
- **Hai loại layout không bị hỏi tới, và không phải vì được ưu ái:** layout **gốc** vẽ khung tài liệu
  và gắn provider, layout **trung chuyển** giao chrome cho một layout khác. Bắt hai loại này đánh dấu
  là tự tay đặt landmark thứ hai vào document.

**Tình huống nghiệp vụ hay gặp.** Layout của một nhóm route có navbar riêng · shell có rail bên trái ·
khu vực học tập có thanh tiến độ trên cùng · khu vực quản trị có breadcrumb.

---

## `LANDMARK-5` — một `main` cho mỗi document

**Tình huống.** Một key tên `dashboard-main`, `profile-main`, `explore-main`. Cái tên nói "main", và
người đọc key tin nó là landmark. **Nó không phải.** Đó là **cột đọc** nằm cạnh rail, bên trong một
trang mà landmark đã được mở ở một tầng trên.

**Dấu hiệu nhận biết**

- Trên cùng một màn hình có nhiều hơn một chỗ tự nhận là "main".
- Key nằm trong một block, một composite hay một leaf — tức là một **phần** của màn hình.
- Bỏ node này đi thì màn hình vẫn còn trang; nó chỉ mất một cột.

**Tự hỏi.** File này sở hữu **cả màn hình**, hay chỉ một phần của màn hình? Chỉ vế đầu mới được mở
landmark.

**Ranh giới**

- ↔ `LANDMARK-4`: xem trên.
- **Hai vật mang, hai tập file khác nhau — và gộp chúng lại từng là một lỗi thật.** Branch landmark là
  thứ có người **import về để bọc một màn hình**: nó ở lại file route, vì một trang với tay lấy nó
  chính là cái bẫy luật này được viết ra để chặn. Còn một entry **khai báo host** thì không phải thế:
  không ai import landmark nào cả, registry nói key này mở element gì và frame làm theo. Entry ấy do
  người vẽ node ngoài cùng của màn hình render, mà luật bố cục file nói rất rõ file route **không phải**
  người đó: route gắn một trang vào một URL và tự nó không vẽ gì.

  Giữ cả hai về mỗi file route, hai luật quay ra **từ chối lẫn nhau**: mọi trang chuyển ra khỏi cây
  route để tuân luật bố cục đều bị báo là đặt sai landmark, và cách duy nhất thoả mãn cả hai là để
  người sở hữu trang nằm lại trong cây route — đúng cái khuyết tật mà luật bố cục sinh ra để ngăn. Một
  luật chỉ có thể tuân thủ bằng cách phá một luật khác là một **phát hiện về chính luật đó**.

**Tình huống nghiệp vụ hay gặp.** Cột nội dung cạnh rail hồ sơ · cột kết quả cạnh filter · vùng nội
dung của một tab · panel chi tiết cạnh danh sách · khung hội thoại cạnh hộp thư.

---

## Luật

1. Mỗi landmark element có **branch riêng**, giống branch thường ở mọi điểm trừ element nó mở.
2. Branch landmark **chỉ** cấp element. Class, tập con được nhận và lý do vẫn nằm ở key.
3. Element **không** phải prop. Call site không chọn ý nghĩa của document.
4. Layout dựng chrome quanh trang được route là file đánh dấu trang đó. Layout gốc và layout trung
   chuyển **không** bị hỏi tới.
5. Một `main` cho mỗi document, thuộc về người sở hữu **cả màn hình**: file route, hoặc bề mặt trang.
6. Landmark viết tay không mang key, nên không có gì ghi lại class, con và lý do của nó.
7. Một key tên `*-main` là một **cái tên**; chỉ `host` đã khai báo mới là một **lời hứa**.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã
nó áp dụng vào.

- **File cài đặt của chính branch landmark.** `LANDMARK-1` cho phép **đúng một file** viết element ra
  bằng tay, y như branch thường là nơi duy nhất một `div` được viết ra.
- **Layout gốc.** `LANDMARK-4` không với tới. Nó vẽ `html`, `body` và gắn provider.
- **Layout trung chuyển.** `LANDMARK-4` không với tới layout giao chrome cho layout khác.
- **Bề mặt trang.** Theo `LANDMARK-5`, một entry khai báo host được phép nằm ở bề mặt trang, còn
  **branch** landmark thì không. Hai vật mang, hai tập file.
- **Luật này không giữ được trường hợp xuyên file.** Một rule đọc từng file không thể thấy rằng một
  layout và một trang bên dưới nó **cùng** mở landmark. Rule thu hẹp chỗ được phép về file route và
  từ chối mọi tầng bên dưới — đúng chỗ sai lầm thật sự xảy ra. Phần còn lại là một câu hỏi review.
  Nói thẳng ra như vậy rẻ hơn là dựng một cổng ngụ ý một bảo đảm mà nó không có.
