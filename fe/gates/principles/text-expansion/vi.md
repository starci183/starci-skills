---
id: fe-principles-text-expansion-vi
title: vi.md
slug: /gates/principles/text-expansion/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống EXPANSION-N, nhận diện bằng nguồn chuỗi và tập ngôn ngữ chứ không bằng chuỗi đang thấy.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `text-expansion`

# Độ giãn văn bản

Độ giãn văn bản là **độ dài mà một chuỗi thay đổi khi đổi ngôn ngữ**, và **chiều mà nó chạy** khi
ngôn ngữ đó viết từ phải sang trái.

Một chuỗi trên màn hình không phải một đại lượng cố định. Nó là **một trong nhiều bản dịch**, và cái
hộp chứa nó phải sống được với **bản dài nhất**, không phải bản đang mở trên máy người viết mã.

Hãy nhìn một chuỗi và hỏi:

> Chuỗi này dài ra bao nhiêu ở ngôn ngữ khác, và ai chịu phần dài thêm đó?

Câu trả lời **không bao giờ** là "cắt bớt chữ đi". Chữ là nội dung, hộp là quyết định của mình.

**Đây là luật bắt buộc.** Mọi đoạn liền mạch được hiển thị đều rơi vào đúng một mã độ dài dưới đây. Không có chuỗi
nào ngắn tới mức được miễn — ngược lại, **chuỗi càng ngắn càng nguy hiểm**, vì nó là chuỗi nở nhiều
nhất theo tỉ lệ. `Save` (4 ký tự) thành `Speichern` (9). `Undo` thành `Rückgängig`. `Next` thành
`Tiếp theo`. Một cái nút đo vừa khít bốn ký tự thì ở ngôn ngữ thứ hai nó không còn là nút nữa. Câu
"có mỗi một chữ thôi mà" là chỗ luật này bị bỏ qua nhiều nhất.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | `className` |
|---|---|---|
| `EXPANSION-0` | Đoạn liền mạch giống hệt nhau ở mọi ngôn ngữ — không có gì để chừa | *không khai báo class CSS nở* |
| `EXPANSION-1` | Một đoạn liền mạch dịch được; **hộp của chính nó** phải nuốt được phần dài thêm | `w-auto whitespace-normal` |
| `EXPANSION-2` | Một **cột/hàng dùng chung** cho nhiều đoạn liền mạch dịch được, đo theo ngôn ngữ rộng nhất | `min-w-fit` · `grid-cols-[max-content_minmax(0,1fr)]` · `flex-wrap` |
| `EXPANSION-3` | Một câu bị ghép từ nhiều mảnh — **trật tự từ thuộc về ngôn ngữ** | *không class CSS — gom thành một đoạn liền mạch có văn bản gợi ý* |
| `EXPANSION-4` | Hình học phụ thuộc chiều đọc, **phải lật** khi RTL | `ps-*` `pe-*` `ms-*` `me-*` `text-start` `start-*` `rtl:-scale-x-100` |
| `EXPANSION-5` | Đoạn liền mạch hoặc hình dạng ký tự mà **lật là sai nghĩa** | `dir="ltr"` · *không dùng `rtl:`* |
| `EXPANSION-6` | Giá trị do ngôn ngữ **in ra**: số, ngày, tiền tệ, số nhiều, danh sách | `tabular-nums` |

### Ba câu hỏi, hỏi theo đúng thứ tự này

Đơn vị quyết định là **một đoạn liền mạch và cái hộp giữ nó**.

1. **Độ dài** — đoạn liền mạch này đổi độ dài khi đổi ngôn ngữ không, và ai chịu phần đổi đó? Câu này **phủ kín**:
   mọi đoạn liền mạch đều trả lời bằng đúng một trong `EXPANSION-0`, `EXPANSION-1`, `EXPANSION-2`, `EXPANSION-3`.
2. **Chiều** — hình học của hộp này, hoặc nghĩa của hình dạng ký tự này, có phụ thuộc chiều đọc không? Trả lời
   bằng `EXPANSION-4` hoặc `EXPANSION-5`, và **chỉ khi** thật sự có hình học phụ thuộc chiều.
3. **Hình dạng** — đoạn liền mạch này là **giá trị máy in ra** hay là **câu người dịch viết**? Trả lời bằng
   `EXPANSION-6`, và chỉ với giá trị máy.

Một dòng tiền trong bảng trả lời cả ba: nó nằm trong cột số dùng chung (`EXPANSION-2`), chữ số của nó
không lật (`EXPANSION-5`), và dấu phân cách, ký hiệu cùng **vị trí ký hiệu** là quyền của ngôn ngữ
(`EXPANSION-6`).

### Dải nở theo độ dài nguồn

Chừa chỗ theo **độ dài của chuỗi nguồn**, không theo cảm giác.

| Độ dài nguồn (ký tự) | Phần phải sống thêm được |
|---|---|
| 1–10 | 100–200% |
| 11–20 | 80–100% |
| 21–30 | 60–80% |
| 31–50 | 40–60% |
| 51–70 | 31–40% |
| trên 70 | 30% |

Đây là **sàn của cái hộp**, không phải **hạn mức của người dịch**. Bảo người dịch "viết ngắn lại cho
vừa nút" là lấy cái nút làm chuẩn cho ngôn ngữ, ngược hoàn toàn.

Co lại cũng là cùng một luật đọc ngược. Nhiều chuỗi CJK chỉ còn khoảng một nửa độ dài nguồn — nhưng
điều đó **không** cho phép đo hộp theo bản ngắn nhất. Hộp đúng là hộp **chứa được ngôn ngữ dài nhất** và
**không trông trống hoác** khi giữ ngôn ngữ ngắn nhất.

---

## `EXPANSION-0` — đoạn liền mạch giống hệt ở mọi ngôn ngữ

**Tình huống.** Chuỗi này không đi qua bản dịch và cũng không đi qua bộ định dạng. Tập giá trị của nó
**liệt kê hết được lúc bản dựng** và **có trần độ dài**. Đổi sang tiếng Đức hay tiếng Ả Rập thì vẫn đúng
từng hình dạng ký tự đó.

**Dấu hiệu nhận biết**

- Không có mục nào cho nó trong danh mục bản dịch, và cũng không nên có.
- Dịch nó ra là **sai**, không phải là "chưa dịch": `PDF` dịch thành gì cũng hỏng.
- Tập giá trị đóng: đuôi tệp, mã ISO, mã trạng thái, phím tắt, số hiệu phiên bản.

**Tự hỏi.** Nếu ngày mai bật thêm một ngôn ngữ nữa, chuỗi này có đổi lấy một hình dạng ký tự nào không? Nếu
không — `EXPANSION-0`.

**Ranh giới**

- `EXPANSION-1`: `PDF` là `EXPANSION-0`; chữ "Tệp PDF" là `EXPANSION-1`, vì phần "Tệp" có bản dịch.
- `EXPANSION-6`: `USD` là `EXPANSION-0` (mã ISO đóng); `1.234,56 ₫` là `EXPANSION-6` (ngôn ngữ in ra,
  và độ dài đổi theo ngôn ngữ).
- vấn đề **độ dài không giới hạn**: một thư điện tử người dùng nhập cũng không đổi theo ngôn ngữ, nên nó
  vẫn là `EXPANSION-0` ở trục này. Việc nó có thể dài 60 ký tự là chuyện của mô-đun cắt/tràn, **không
  phải** chuyện của mô-đun này. Đừng lấy độ dài dữ liệu làm lý do đổi mã.

**Tình huống nghiệp vụ hay gặp.** Đuôi tệp · mã ISO tiền tệ và quốc gia · mã trạng thái HTTP · phím
tắt `⌘K` · số hiệu phiên bản `v2.4.1` · mã đơn `SKU-8891` · hash commit · địa chỉ thư điện tử · tên đăng
nhập · mã màu hex · tên miền.

---

## `EXPANSION-1` — một đoạn liền mạch dịch được, hộp của chính nó phải nuốt

**Tình huống.** Một đoạn liền mạch duy nhất, đến từ danh mục bản dịch, nằm trong **hộp của riêng nó**: một nút,
một nhãn nhỏ, một nhãn trạng thái, một mục trình đơn, một dòng trạng thái rỗng. Không có đoạn liền mạch nào khác chia bề rộng với nó.

**Dấu hiệu nhận biết**

- Xoá đoạn liền mạch này đi thì cái hộp không còn lý do tồn tại.
- Bề rộng hộp hiện tại là **hệ quả** của chuỗi, không phải một quyết định bố cục.
- Chuỗi nguồn ngắn — và theo bảng dải nở, ngắn nghĩa là nở nhiều nhất.

**Tự hỏi.** Nếu đoạn liền mạch này dài gấp đôi, cái hộp này tự nó nuốt được không, hay phải ai khác nhường chỗ?
Nếu tự nuốt — `EXPANSION-1`.

**Ranh giới**

- `EXPANSION-0`: hỏi danh mục. Có mục dịch ⇒ `EXPANSION-1`.
- `EXPANSION-2`: `EXPANSION-1` là **một** đoạn liền mạch tự quyết bề rộng của mình; `EXPANSION-2` là **nhiều**
  đoạn liền mạch cùng bị một cột/hàng quyết hộ. Một nút đứng riêng là `EXPANSION-1`; cột nhãn của cả biểu mẫu là
  `EXPANSION-2`.
- `EXPANSION-3`: nếu đoạn liền mạch này thật ra là **một mảnh** của một câu, nó không được xét riêng.

**Tình huống nghiệp vụ hay gặp.** Nhãn nút chính và nút phụ · mục trình đơn · thẻ tab · nhãn nhỏ lọc · nhãn trạng thái trạng
thái · chú giải của nút chỉ có biểu tượng · văn bản gợi ý ô tìm kiếm · tiêu đề trạng thái rỗng · nhãn hộp kiểm và
nút chọn · nút trong thông báo nổi · nhãn bước của trình hướng dẫn · nút trong hộp thoại xác nhận.

---

## `EXPANSION-2` — một cột dùng chung cho nhiều đoạn liền mạch

**Tình huống.** Bề rộng ở đây là **quyết định bố cục**, và nó phục vụ **nhiều đoạn liền mạch cùng lúc**: cột
nhãn của biểu mẫu, dải thẻ tab, hàng nút, phần đầu của bảng, cột điều hướng. Chọn sai một con số là sai cho tất cả
các đoạn liền mạch trong rãnh đó, ở tất cả các ngôn ngữ.

**Dấu hiệu nhận biết**

- Có một `w-*`, `basis-*` hay `grid-cols-*` mà **con số của nó ra đời sau khi ai đó nhìn một bản
  dịch**.
- Nhiều phần tử phải thẳng hàng với nhau, nên không phần tử nào được tự do nở.
- Ở một ngôn ngữ nào đó, một trong các đoạn liền mạch sẽ là đoạn liền mạch dài nhất — và không ai biết trước là đoạn liền mạch nào.

**Tự hỏi.** Bề rộng này đang phục vụ một đoạn liền mạch, hay đang phục vụ cả một cột? Nếu là cả cột —
`EXPANSION-2`, và cột phải suy ra từ **nội dung**, không từ một con số gõ tay.

**Ranh giới**

- `EXPANSION-1`: xem trên. Phép thử là **đếm số đoạn liền mạch bị bề rộng này ràng buộc**.
- `EXPANSION-0`: một cột chỉ chứa đoạn liền mạch `EXPANSION-0` **được phép** đo cứng. Cột mã ISO ba ký tự thì
  đo cứng đúng; cột **tên** tiền tệ thì không.

**Tình huống nghiệp vụ hay gặp.** Cột nhãn trong biểu mẫu hai cột · dải thẻ tab · hàng nút phần cuối của hộp thoại
· phần đầu bảng · thanh bên điều hướng · cột "thuộc tính" trong bảng thông số · nhãn của các trường trong
màn hình cài đặt · nhóm nút phân đoạn · cột đơn vị trong bảng số liệu.

---

## `EXPANSION-3` — một câu bị ghép từ nhiều mảnh

**Tình huống.** Một câu bị chẻ thành nhiều phần tử anh em để chèn số hoặc để tô đậm một phần. Trật tự
các mảnh bị **đóng cứng vào mã đánh dấu**, trong khi trật tự từ là quyền của từng ngôn ngữ. Ở ngôn ngữ RTL,
các mảnh còn hiện ra theo thứ tự ngược lại.

**Dấu hiệu nhận biết**

- Trong JSX có hai hay nhiều `<span>` chứa **các mảnh của cùng một câu**.
- Có dấu cách hoặc dấu câu nằm ngoài chuỗi dịch: `{"Showing "}{n}{" of "}{total}`.
- Có chuỗi dịch kết thúc lửng: `"Đã chọn"` rồi ghép tiếp một số.
- Có `"item" + (n > 1 ? "s" : "")` — một quy tắc số nhiều của **một** ngôn ngữ đem áp cho mọi ngôn ngữ.

**Tự hỏi.** Người dịch có được phép đảo thứ tự các mảnh này không? Nếu **không** mà đáng lẽ phải được
— `EXPANSION-3`.

**Ranh giới**

- `EXPANSION-1`: một đoạn liền mạch trọn vẹn có nghĩa tự thân là `EXPANSION-1`. Một mảnh cụt là `EXPANSION-3`.
- `EXPANSION-6`: `EXPANSION-6` lo **hình dạng của con số**; `EXPANSION-3` lo **vị trí của nó trong
  câu**. Một câu có số thường mang cả hai mã, ở hai cấp khác nhau.

**Không có class CSS nào sửa được `EXPANSION-3`.** Sửa nó là sửa mã đánh dấu: **một** đoạn liền mạch, văn bản gợi ý nằm bên
trong, và người dịch nắm toàn bộ trật tự.

**Tình huống nghiệp vụ hay gặp.** "Hiển thị 10 trên 240 kết quả" · "Còn 3 ngày" · "Cập nhật bởi An
lúc 09:12" · "Bạn đã chọn 5 mục" · "Giỏ hàng (2 sản phẩm)" · câu có một từ được in đậm giữa chừng ·
câu có liên kết nằm giữa · thông báo lỗi ghép tên trường vào giữa · đơn vị ghép sau số.

---

## `EXPANSION-4` — hình học phải lật khi RTL

**Tình huống.** Thuộc tính này nói **bên nào**, mà "bên nào" là do chiều đọc quyết định. Ở RTL, cái
đứng "trước" nằm bên phải. Viết theo trục lô-gic thì nó tự đúng ở cả hai chiều; viết theo trục vật lý
thì nó đúng ở một chiều và sai ở chiều kia **mà không báo lỗi**.

**Dấu hiệu nhận biết**

- Khoảng cách giữa biểu tượng và nhãn, giữa ảnh đại diện và tên.
- Thụt lề của cây, của trích dẫn, của cấp bậc.
- Neo của ngăn trượt, khung, nhãn trạng thái góc, nút nổi.
- Mũi tên **chỉ hướng di chuyển**: quay lại, tiếp theo, đường dẫn phân cấp, "trả lời", hoàn tác và làm lại.
- Canh chữ của cả một khối văn bản.

**Tự hỏi.** Nếu cả màn hình soi gương, thuộc tính này còn nói đúng điều nó đang nói không? Nếu **phải
soi gương theo** — `EXPANSION-4`.

**Ranh giới**

- `EXPANSION-5`: hỏi **hình dạng ký tự đang nói về cái gì**. Mũi tên nói "quay lại trong lịch sử" thì lật;
  mũi tên trên nút phát nói "chạy tới trong bản ghi" thì không. Cùng một hình tam giác, hai mã.
- `EXPANSION-2`: `EXPANSION-2` là **bao nhiêu chỗ**; `EXPANSION-4` là **chỗ đó nằm bên nào**. Hai
  câu hỏi khác nhau, thường cùng có mặt trên một hộp.

**Tình huống nghiệp vụ hay gặp.** Khoảng đệm trong của danh sách phần tử có biểu tượng dẫn đầu · thụt lề cây thư mục ·
ngăn trượt neo mép · nhãn trạng thái đếm ở góc ảnh đại diện · biểu tượng chữ V của đường dẫn phân cấp và vùng thu gọn · nút quay lại · viền
trái của trích dẫn · canh phải của cột số **trong ngữ cảnh bố cục** · bo góc của nhóm nút phân đoạn ·
vị trí nhãn của thanh trượt tiến độ tác vụ.

---

## `EXPANSION-5` — lật là sai nghĩa

**Tình huống.** Có những thứ **không thuộc về chiều đọc**. Chúng giữ nguyên chiều ở mọi ngôn ngữ, vì
chiều của chúng đến từ một hệ quy chiếu khác: toán học, thời gian tuyến tính, hoặc bản sắc thương
hiệu.

**Dấu hiệu nhận biết**

- **Chữ số.** Trong một câu tiếng Ả Rập, cụm số vẫn chạy trái sang phải. Đây là hành vi của thuật
  toán bidi, không phải tuỳ chọn.
- **Điều khiển phát lại.** Phát, tua tới, tua lui, và thanh thời lượng — chiều của chúng là chiều của
  băng ghi, không phải chiều của câu.
- **Biểu tượng thương hiệu và dấu chữ thương hiệu.**
- **Đồ thị có trục thời gian**, đồng hồ, lịch dạng dải thời gian.
- **Chuỗi kỹ thuật nhúng trong câu**: URL, đường dẫn tệp, mã lệnh, thư điện tử, số phiên bản.
- Dấu tích, dấu cộng, biểu tượng không có hướng.

**Tự hỏi.** Chiều của thứ này đến từ **câu văn** hay từ **một hệ khác** (thời gian, số học, thương
hiệu)? Nếu từ hệ khác — `EXPANSION-5`.

**Ranh giới**

- `EXPANSION-4`: xem trên. Phép thử nghiệp vụ rõ nhất là **thanh tiến độ**: thanh báo "đã xong bao
  nhiêu phần việc" thì lật (`EXPANSION-4`); thanh báo "đang ở phút thứ mấy của bản ghi" thì không
  (`EXPANSION-5`).
- `EXPANSION-6`: `EXPANSION-5` giữ **chiều** của cụm số; `EXPANSION-6` chọn **hình dạng** của nó.
  Một số tiền cần cả hai và chúng không thay nhau được.

**Chuỗi nhúng phải được cô lập.** Một URL nằm giữa câu RTL mà không được cô lập chiều sẽ bị dấu câu ở
hai đầu kéo sang chỗ khác — chuỗi hiển thị ra vẫn là chuỗi cũ nhưng **đọc ra thì sai**, và người viết
mã ở ngôn ngữ LTR không bao giờ nhìn thấy.

**Tình huống nghiệp vụ hay gặp.** Nút phát và thanh thời lượng · số phiên bản trong câu · giá tiền ·
mã đơn hàng trong thông báo · biểu đồ doanh thu theo tháng · biểu trưng · đồng hồ đếm ngược · đoạn mã
trong tài liệu · số điện thoại · dấu tích trạng thái.

---

## `EXPANSION-6` — giá trị do ngôn ngữ in ra

**Tình huống.** Đoạn liền mạch này không phải câu người dịch viết; nó là **kết quả của một quy tắc trình bày**
thuộc về ngôn ngữ. Dấu phân cách nghìn, dấu thập phân, thứ tự ngày tháng, vị trí ký hiệu tiền tệ, dạng
số nhiều, cách nối một danh sách — tất cả đều đổi, và độ dài đổi theo.

**Dấu hiệu nhận biết**

- Có dấu `,` hoặc `.` được gõ tay giữa các chữ số.
- Có ký hiệu tiền tệ được **nối chuỗi** vào trước hoặc sau con số.
- Có `MM/DD/YYYY` hoặc `DD/MM/YYYY` đóng cứng trong mã.
- Có `n > 1 ? "s" : ""`, hoặc `"(s)"`, hoặc hai nhánh if cho số ít và số nhiều.
- Có `join(", ")` để nối một danh sách đọc thành câu.

**Tự hỏi.** Chuỗi này do **người dịch viết** hay do **máy in ra theo quy tắc của ngôn ngữ**? Nếu máy in
— `EXPANSION-6`, và nó phải đi qua bộ định dạng của ngôn ngữ.

**Ranh giới**

- `EXPANSION-0`: mã ISO `USD` là hằng số đóng; **số tiền** thì không.
- `EXPANSION-3`: `EXPANSION-3` quyết định **câu ôm lấy giá trị**; `EXPANSION-6` quyết định **giá trị
  in ra thế nào**. Sửa một cái mà bỏ cái kia là mới đi được nửa đường.
- `EXPANSION-2`: một cột số vẫn cần `EXPANSION-2`, vì cùng một giá trị ở ngôn ngữ khác **dài hơn**:
  `1,234.56` và `1 234,56` không cùng bề rộng, và bản Ả Rập còn dài hơn nữa.

**Số nhiều không phải hai nhánh.** Có ngôn ngữ chỉ có một dạng, có ngôn ngữ có tới sáu. Viết hai nhánh
là đóng cứng ngữ pháp của một ngôn ngữ vào tất cả các ngôn ngữ còn lại.

**Tình huống nghiệp vụ hay gặp.** Giá và tổng tiền · ngày phát hành · thời gian tương đối "3 ngày
trước" · phần trăm hoàn thành · dung lượng tệp · số lượng rút gọn "12,4K" · khoảng thời gian của bài
học · danh sách tên tác giả nối thành câu · số thứ tự · đơn vị đo.

---

## Luật

1. Cái hộp nuốt phần dài thêm. **Không sửa chữ cho vừa hộp.**
2. Không có bề rộng nào được suy ra từ việc đo **một** ngôn ngữ.
3. Đoạn liền mạch dịch được thì không `whitespace-nowrap` trong một hộp có trần. Chỉ `EXPANSION-0` mới được.
4. Rãnh dùng chung đo theo **ngôn ngữ rộng nhất**, không theo ngôn ngữ đang mở.
5. Một câu là **một** đoạn liền mạch có văn bản gợi ý. Ghép mảnh là lỗi ở mọi ngôn ngữ, và là lỗi **nhìn thấy được**
   ở ngôn ngữ RTL.
6. Khoảng cách, khoảng tách, canh lề, bo góc mặc định dùng **trục lô-gic**. Dùng trục vật lý là một lời
   khẳng định rằng thuộc tính đó không lật — và lời khẳng định đó phải đúng.
7. Số, biểu trưng, điều khiển phát lại và đồ thị theo thời gian **không lật**.
8. Giá trị do ngôn ngữ in ra thì đi qua bộ định dạng, **không nối chuỗi**.
9. Một mã, một className. Đổi ngôn ngữ, đổi khung nhìn hay đổi trạng thái tải **không** làm đổi mã.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Đo cứng cho đoạn liền mạch bất biến.** Một rãnh được đo chính xác **khi và chỉ khi** mọi đoạn liền mạch trong đó là
  `EXPANSION-0`. Cột mã ISO ba ký tự thì được; cột tên tiền tệ thì không.
- **Đảo nhúng trong câu RTL.** URL, đường dẫn, đoạn mã, thư điện tử, mã đơn nằm giữa câu RTL là một đảo
  `EXPANSION-5` bên trong hộp `EXPANSION-4`. **Đảo** là ngoại lệ, không phải cả câu.
- **Nút chỉ có biểu tượng.** Không có chữ hiện ra **không** làm mất tình huống: tên trợ năng và chú giải vẫn
  là đoạn liền mạch dịch được, và hộp chú giải là `EXPANSION-1`.
- **Cặp hình dạng ký tự lật cùng nhau.** Hoàn tác và làm lại, trước và sau, trả lời và chuyển tiếp — lật cả cặp
  hoặc không lật cặp nào. Lật đúng một nửa còn tệ hơn không lật.
- **Tiến độ tác vụ và tiến độ nội dung đa phương tiện.** Cùng một hình dạng thanh, hai mã khác nhau, và cái phân định
  là **thanh đó đang nói về cái gì**.
- **Hai mã độ dài cùng khớp.** Chọn mã **giữ được đoạn liền mạch nguyên vẹn**. Nở ra thì còn sống chung được;
  một thành phần điều khiển không nói nổi tên của chính nó thì không.
- **Giả-bản địa hoá.** Bản bản dựng kéo dài chuỗi là **bằng chứng** cho một mã, không phải một mã, và
  càng không phải một class CSS.
- **CJK ngắn hơn.** Hộp trông rộng ở ngôn ngữ ngắn nhất **không** phải lý do thu hộp lại. Trần của hộp
  thuộc về ngôn ngữ dài nhất.
