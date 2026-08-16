---
id: fe-lints-tokens-vi
title: vi.md
slug: /fe/lints/tokens/vi
sidebar_label: vi.md
sidebar_position: 1
description: Bốn luật máy của token — bắt gì, giữ mã nào, phát hiện bằng cách nào, và cửa nào còn mở.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `tokens`

# Bốn luật máy giữ token

Phần lớn luật token do **kiểu dữ liệu** giữ: mọi tầng trên lá lấy class từ một entry đã đánh kiểu,
nên một giá trị lệch thang ở đó không phải là chuyện bị bắt lỗi khi review — nó **không biên dịch
được**. Không còn gì để tuần tra.

Bốn luật dưới đây tồn tại cho đúng một chỗ mà kiểu dữ liệu không với tới: **thư mục lá**, nơi được
miễn luật entry và tự viết chuỗi class của mình. Đó là chỗ duy nhất một bậc lẻ, một độ dài trong
ngoặc vuông hay một tiêu đề tự ráp vẫn gõ được và vẫn qua trình biên dịch.

Ba trong bốn luật dùng **chung một bộ duyệt**. Hiểu bộ duyệt đó là hiểu ba phần tư trang này:

- Cổng đường dẫn: đường dẫn tệp phải chứa `/src/`, nếu không thì **không luật nào chạy**.
- Ba chỗ đọc: thuộc tính `className`/`class` trong JSX, **mọi** khai báo biến, và thuộc tính có khoá
  đúng chữ `classes`.
- Một bộ đọc: chỉ hiểu chuỗi thường, template không có biểu thức, và mảng các thứ đó (nối bằng dấu
  cách). Mọi hình dạng khác trả về `null` — tức là **không thấy gì**.

## Bảng tra nhanh

| Luật | Mã luật | Bắt gì |
|---|---|---|
| `no-fractional-step` | `TOKEN-3` | Bậc lẻ trong chuỗi class tĩnh: `gap-1.5`, `p-2.5`, `size-3.5` |
| `no-arbitrary-value` | `TOKEN-4` | Độ dài trong ngoặc vuông ở họ giãn cách/kích thước, và màu hex `#` ở họ màu |
| `no-hand-rolled-heading` | `TOKEN-5` | Cỡ chữ lớn đi cùng độ đậm nặng trong **một** chuỗi class |
| `no-unresolved-token-class` | `TOKEN-9` | Class gọi tên một token mà biến CSS tương ứng không có trong tệp kiểu dáng |

---

## `no-fractional-step`

**Bắt gì?** Một bậc đo lẻ nửa rung: `gap-1.5`, `px-2.5`, `size-3.5`, `mt-0.5`. Thông điệp nêu đúng
class đã khớp.

**Giữ mã nào?** `TOKEN-3` — *bậc lẻ không bao giờ nằm trên thang*.

**Phát hiện thế nào?** Một biểu thức chính quy duy nhất chạy trên chuỗi đã nối: liệt kê 25 tên họ
(`gap`, `gap-x`, `gap-y`, `p`, `px`, `py`, `pt`, `pb`, `pl`, `pr`, `m`, `mx`, `my`, `mt`, `mb`,
`ml`, `mr`, `space-x`, `space-y`, `inset`, `top`, `bottom`, `left`, `right`, `size`, `w`, `h`) rồi
tới `-<số>.<số>`, chặn hai đầu bằng ranh giới từ. Dùng `match`, nên **chỉ báo hit đầu tiên**.

**Vì sao nên để máy giữ luật này?** Các rung là số nguyên và **thưa không đều**, nên nửa rung không
phải là "nằm giữa hai rung" — nó rơi khỏi thang, và sẽ không khớp với bất cứ thứ gì trên bất cứ màn
hình nào. Đây là loại lỗi mắt thường không bắt được: `gap-1.5` trông hoàn toàn hợp lý cạnh `gap-2`,
và chỉ lộ ra khi có người đi đo cả sản phẩm. Giá trị lệch thang cuối cùng trong nguồn viết ra bộ
luật này nằm trong một **hằng số module**, chỗ mọi luật chỉ duyệt thuộc tính JSX đều nhìn xuyên qua.

**Những chỗ còn lọt.** Bốn họ kích thước bị thiếu: `min-w-3.5`, `min-h-1.5`, `max-w-2.5`, `max-h-1.5` đều
là bậc lẻ và đều không bị báo. Các thuộc tính logic và theo trục cũng thiếu: `ps-1.5`, `pe-1.5`,
`ms-1.5`, `me-1.5`, `inset-x-1.5`, `inset-y-1.5` — `inset` có trong danh sách, hai dạng trục của nó
thì không. Và vì chỉ báo hit đầu tiên, một chuỗi có ba bậc lẻ cần ba lượt mới sạch.

---

## `no-arbitrary-value`

**Bắt gì?** Hai thông điệp tách rời phát ra từ cùng một chuỗi: một **độ dài trong ngoặc vuông**
(`w-[420px]`, `gap-[13px]`, `max-w-[62rem]`), và một **màu hex thô** (`text-[#2563eb]`,
`bg-[#0b1220]`).

**Giữ mã nào?** `TOKEN-4` — *giá trị tuỳ ý thoát khỏi hệ thống, bất kể nó tính ra bao nhiêu*.

**Phát hiện thế nào?** Hai biểu thức chính quy. Bên độ dài liệt kê 21 họ — tập giãn cách và kích thước
cộng `min-w`, `min-h`, `max-w`, `max-h`, bỏ các họ vị trí — theo sau là `-[` cho tới dấu `]` đầu
tiên. Bên màu liệt kê 10 họ (`text`, `bg`, `border`, `ring`, `from`, `to`, `via`, `fill`, `stroke`,
`shadow`, `decoration`) theo sau là đúng ba ký tự `-[#` và một chữ số hex.

**Vì sao nên để máy giữ luật này?** Một giá trị trong ngoặc vuông là giá trị **được chọn một lần,
bởi một người, cho một màn hình**. Ngay cả khi nó tình cờ bằng đúng một rung, không ai tra thang tìm
ra được nó, và khi thang đổi thì nó đứng yên. Với màu, tên gọi theo **ý nghĩa** thì đi theo chủ đề
giao diện; tên gọi theo **giá trị** thì giữ nguyên trong cái chủ đề mà nó sai. Đây cũng là hình dạng
thông thường của một bản vá vội, nên trong một kho có lịch sử, luật này thường báo nhiều nhất.

**Những chỗ còn lọt.** Tên luật hứa "mọi giá trị tuỳ ý", biểu thức chính quy chỉ phủ giãn cách và kích
thước. `text-[28px]`, `tracking-[0.2em]`, `leading-[1.15]`, `grid-cols-[14rem_1fr]`,
`duration-[250ms]`, `aspect-[4/3]` — không họ nào trong danh sách, không cái nào bị báo. Màu không
viết bằng hex cũng lọt hết: `bg-[rgb(37,99,235)]`, `text-[hsl(210_20%_98%)]`,
`shadow-[0_1px_2px_rgba(0,0,0,.08)]`. Và `style={{ padding: "6px", color: "#2563eb" }}` không phải
class, nên không luật nào ở đây nhìn thấy — trong khi đó là cách trực tiếp nhất để viết ra đúng hai
thứ luật này cấm.

---

## `no-hand-rolled-heading`

**Bắt gì?** Một chuỗi class tĩnh chứa **đồng thời** một cỡ chữ lớn và một độ đậm nặng. Thông điệp
không nêu class nào, vì phát hiện ở đây là **cặp**, không phải một giá trị.

**Giữ mã nào?** `TOKEN-5` — *thứ bậc đến từ thang chữ, không đến từ một tổ hợp tự ráp*.

**Phát hiện thế nào?** Hai biểu thức chính quy, cả hai phải `test` đúng trên cùng một chuỗi:
`text-(xl|2xl|3xl|4xl|5xl)` và `font-(bold|extrabold|black)`.

**Vì sao nên để máy giữ luật này?** Chữ lớn cộng nét đậm **là** một tiêu đề, dù nó nằm trên thẻ
nào. Ráp bằng class thô thì đó là một tiêu đề **không có gì khác biết tới**: dàn ý mà trình đọc màn
hình dựng ra không chứa nó, và ngày thang chữ đổi thì nó ở lại phía sau. Đây là thiệt hại không nhìn
thấy được bằng mắt trên màn hình — trông vẫn y hệt tiêu đề thật — nên nếu không có máy giữ thì
không có cách nào bắt.

**Những chỗ còn lọt.** `font-semibold` **không** nằm trong danh sách nét đậm, mà `text-2xl font-semibold`
lại là cách viết tiêu đề tự ráp phổ biến nhất trong nguồn thật. Danh sách cỡ dừng ở `5xl`, nên
`text-6xl font-bold` — một tiêu đề còn to hơn mọi thứ luật này canh — đi qua bình thường; `text-[2rem]
font-bold` cũng vậy, và không luật nào ở đây thấy `text-[2rem]`. Cuối cùng, **cặp phải nằm trong một
chuỗi**: cỡ ở cha còn nét đậm ở con, cỡ trong hằng số còn nét đậm ở nơi gọi, hay nét đậm đến từ chính
thẻ `<strong>` — mỗi nửa đứng riêng đều hợp lệ.

---

## `no-unresolved-token-class`

**Bắt gì?** Một class **gọi tên** một token của chủ đề giao diện trong khi biến CSS tương ứng không
được định nghĩa ở đâu cả. Thông điệp nêu cả class lẫn tên biến còn thiếu.

**Giữ mã nào?** `TOKEN-9` — *một class gọi tên token thì chưa có nghĩa gì cho tới khi chủ đề định
nghĩa nó*.

**Phát hiện thế nào?** Luật này lấy bằng chứng từ **hệ tệp**, không từ cây cú pháp. Từ thư mục của tệp
đang lint, nó đi ngược lên tối đa 12 cấp, mỗi cấp thử tồn tại 5 đường dẫn tệp kiểu dáng ứng viên, đọc
và nối mọi tệp tìm thấy, có bộ nhớ đệm theo thư mục cho cả lượt chạy. **Không tìm thấy tệp nào thì
luật tự tắt.** Tìm thấy thì nó tách chuỗi class theo khoảng trắng, gỡ **một** tiền tố biến thể dạng
`[a-z-]+:` và **một** dấu `!`, rồi thử ba khuôn: `max-w-app-<tên>`, `max-h-<tên>`, `min-h-<tên>`.
Nếu `<tên>` nằm trong tập tên mà framework tự phân giải (`screen`, `full`, `fit`, `auto`, `none`,
`min`, `max`, `prose`, các đơn vị khung nhìn, `px`) thì bỏ qua. Ngược lại nó suy ra tên biến —
`--container-app-<tên>`, `--max-height-<tên>`, `--min-height-<tên>` — và tìm tên đó trong văn bản tệp
kiểu dáng bằng `includes`.

**Vì sao nên để máy giữ luật này?** Đây là **giá trị chết duy nhất mà một kiểu đóng không bắt
được**. Tên nằm trong union nên trình biên dịch hài lòng; class vẫn được phát ra nên bản dựng hài
lòng; phần tử chỉ đơn giản là không nhận được kích thước nào, và không có gì đỏ ở bất cứ đâu. Nó tệ
hơn một giá trị lệch thang đúng ở chỗ đó: giá trị lệch thang thì **không biên dịch được**, còn cái
này qua mọi cổng và lên sản phẩm.

Tập tên-framework-tự-phân-giải cũng là một bài học đã đo được: lần chạy đầu tiên trên hai kho, luật
báo đúng hai phát hiện và **cả hai đều sai**, đều là những tên như `min-h-screen`. Báo chúng lên là
đẩy người viết đi định nghĩa một biến không ai đọc, và làm hỏng một class đang chạy tốt.

**Những chỗ còn lọt.** **Không có tệp kiểu dáng thì không có luật**: một kho để chủ đề ở đường dẫn khác sẽ
chạy sạch tuyệt đối, và bản chạy đó không phân biệt được với bản chạy thật sự sạch. Chỉ **ba họ**
được kiểm trong khi luật nói về mọi họ gọi tên token — một `w-app-*`, `rounded-*`, `shadow-*` hay
`gap-*` chết đúng y như vậy mà không ai canh, và `max-w-*` không có đoạn `app-` cũng không được
canh. **Biến thể thứ hai làm luật im**: chỉ gỡ được một tiền tố, nên `lg:hover:min-h-panel` vẫn còn
`hover:` khi khuôn neo đầu chuỗi chạy; còn biến thể bắt đầu bằng chữ số như `2xl:` thì không bao giờ
được gỡ. Và **dùng biến được tính là định nghĩa biến**: phép kiểm là `includes` trên văn bản, nên một
dòng `var(--min-height-panel)`, một khai báo đã bị chú thích, hay một tên dài hơn có chứa tên ngắn
hơn đều làm luật hài lòng.

---

## Luật

1. Một luật chỉ báo cái nó **chỉ tay vào được** trong văn bản tĩnh của **một** nút. Không suy diễn
   bắc cầu qua nhiều nút.
2. Tệp nằm ngoài cổng `/src/` thì **không luật nào** ở đây chạy — không phải chạy một phần.
3. Không có bằng chứng thì im, chứ không báo mọi thứ là đáng ngờ.
4. **Tên đã công bố của luật là định danh duy nhất của nó.** Mã luật là một ánh xạ, không phải một
   cái tên thứ hai.
5. Không luật nào ở đây có thẩm quyền trên các tầng mà union đã giữ.
6. Mức nghiêm mà bộ luật tự đề xuất là `error` cho cả bốn, vì cả bốn khớp theo **hình dạng** chứ
   không theo phán đoán.

## Ngoại lệ

Ngoại lệ ở đây là **một phần của cơ chế**, không phải chỗ lách.

- **Tên framework tự phân giải.** Trong `no-unresolved-token-class`, một tên nằm trong tập dành riêng
  được bỏ qua có chủ đích. Đã đo, đã sai hai lần, đã đóng.
- **Thiếu tệp kiểu dáng.** Cùng luật đó tự tắt thay vì tuyên bố mọi token là chết. Đây là lựa chọn
  đúng và đồng thời là một cửa mở, vì im lặng và sạch sẽ trông giống hệt nhau.
- **Biểu thức không đọc được.** Mọi luật coi một biểu thức không tĩnh là **vắng mặt**, không phải là
  vi phạm. Chính lựa chọn đó khiến cửa "hàm gộp class" không thể đóng ở thiết kế này.
- **Miễn trừ theo tầng.** Thư mục lá được miễn luật entry **theo chính sách**, và đó là lý do bốn
  luật này đọc chuỗi class trong nguồn chứ không chỉ đọc entry.
