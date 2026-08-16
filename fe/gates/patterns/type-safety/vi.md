---
id: fe-patterns-type-safety-vi
title: vi.md
slug: /gates/patterns/type-safety/vi
sidebar_label: vi.md
sidebar_position: 1
description: Các tình huống TYPE-SAFETY-N, nhận diện bằng việc trình biên dịch bị bắt quên cái gì.
---

# vi.md

> Version: `2.00` · Module: `type-safety`

# Type safety

Kiểu là **nửa canon mà máy giữ hộ, không cần ai nhắc**. Phần lớn những gì các module khác nói ra
được giữ bởi một union đóng hoặc một alias slot, chứ không phải bởi một rule lint. Nghĩa là giá trị
của hệ kiểu ở đây không phải "ít bug hơn" một cách chung chung. Nó là: **phần lớn canon thôi không
còn là tuỳ chọn.**

Vì vậy module này chỉ có **một** việc: canh những chỗ có người **tắt hệ kiểu đi**. Một cast không sửa
lỗi kiểu; nó **làm im** một lỗi kiểu, đúng tại cái seam mà lỗi đó đáng có mặt nhất.

Câu hỏi phân định mọi mã dưới đây:

> **Trình biên dịch đang biết điều gì mà dòng này bảo nó quên đi?**

Nếu câu trả lời là "không gì cả, hai kiểu vốn khớp nhau" thì cast đó thừa. Nếu câu trả lời là bất cứ
thứ gì khác, cast đó đang **giấu** điều đó.

**Đây là luật bắt buộc.** Mọi lần xoá kiểu trong source đều rơi vào đúng một trong năm tình huống
dưới đây. Không có kích thước nào nhỏ đến mức được miễn mang mã: một dòng `as unknown as` trong một
helper là `TYPE-SAFETY-1`, cũng vì lý do đó mà một `any` lan khắp module là `TYPE-SAFETY-2`. Câu "có
mỗi một dòng thôi mà" chính là câu mở ra cái seam.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Tầng giữ |
|---|---|---|
| `TYPE-SAFETY-1` | Cast xuyên `unknown` — xoá sạch mọi thứ trình biên dịch từng biết | `enforced` |
| `TYPE-SAFETY-2` | `any` — cùng một hành vi xoá, viết ngắn hơn, và nó **lan** | `documented` |
| `TYPE-SAFETY-3` | Một cách viết duy nhất cho mảng: `Array<T>` | `documented` |
| `TYPE-SAFETY-4` | Test được phép dựng giá trị sai, vì đó là thứ nó đang chứng minh | `documented` |
| `TYPE-SAFETY-5` | Cast sống sót qua review thì phải mang lý do ngay bên cạnh | `documented` |

---

## `TYPE-SAFETY-1` — cast xuyên `unknown` là **xoá**, không phải thu hẹp

**Tình huống.** Một giá trị vừa đi từ **ngoài chương trình vào trong**: response mạng, thứ đọc từ
storage, một payload người khác gửi tới, một kiểu vendor không khớp. Nó không có hình dạng mình muốn.
Thay vì kiểm tra, người viết bảo trình biên dịch quên hết đi bằng `x as unknown as T`.

Đây là chỗ dễ nhầm nhất của cả module, nên nói cho rõ: cast **một tầng** như `a as B` vẫn còn là một
lời khai mà trình biên dịch **kiểm được một phần** — nó vẫn từ chối nếu hai kiểu không có gì chung.
Chính vì thế mới phải đi vòng qua `unknown`: `unknown` chung với **mọi** kiểu, nên bước qua nó là
cách hợp pháp hoá một lời khai mà đáng ra không kiểm nổi. Đó không phải thu hẹp. Đó là **xoá**.

Và cái bị xoá đúng là cái đáng giữ nhất: seam nơi giá trị vượt từ ngoài vào trong. Bên trong chương
trình, một cast sai thường được các kiểu khác bắt lại vài dòng sau. Ở biên, không có ai bắt cả — dữ
liệu sai sẽ đi tiếp cho tới lúc nó vỡ ở một chỗ chẳng liên quan gì.

**Dấu hiệu nhận biết**

- Cụm chữ `as unknown as` xuất hiện trong một file không phải test.
- Cast nằm ngay sau `JSON.parse`, `response.json()`, `localStorage.getItem`, hoặc một import vendor.
- Lý do được nêu là *TypeScript kêu*, *nó không chịu nhận*, *biết chắc nó là kiểu này rồi*.

**Tự hỏi.** Nếu ngày mai server đổi field, dòng này có đỏ lên không? Nếu không — không ai đang kiểm
cả, và cast này chính là chỗ việc kiểm bị tắt.

**Ranh giới**

- ↔ `TYPE-SAFETY-2`: `TYPE-SAFETY-1` xoá **tại một dòng**; `TYPE-SAFETY-2` xoá rồi **đi theo giá
  trị** sang mọi file nó chạm tới. Cùng một hành vi, khác bán kính.
- ↔ `TYPE-SAFETY-4`: cùng một cú pháp, khác **file**. Trong `.test.`/`.spec.` thì dựng giá trị sai
  chính là việc của file đó.
- ↔ `TYPE-SAFETY-5`: `TYPE-SAFETY-5` nói về cast **một tầng** còn giữ được lý do. Cast xuyên
  `unknown` không được cứu bằng một dòng comment — lý do không làm cho việc xoá trở lại thành việc
  kiểm.
- **Cast đi *vào* `unknown` là chuyện khác.** `value as unknown` một mình không phải mã này: nó
  chuyển giá trị từ một kiểu không đáng tin sang một kiểu **không dùng được nếu chưa kiểm**. Đó là
  chiều ngược lại, và là chiều luật này muốn.

**Tình huống nghiệp vụ hay gặp.** Body của một response REST · payload đã decode của một token · một
record đọc từ `localStorage` · một kiểu vendor khai sai · một event của thư viện bên thứ ba · dữ liệu
seed đưa vào một hàm đã đóng kiểu.

---

## `TYPE-SAFETY-2` — `any` là cùng một hành vi xoá, và nó lan

**Tình huống.** Hình dạng thật sự chưa biết, nên người viết đặt `any` cho xong. Khác biệt so với
`TYPE-SAFETY-1` không nằm ở mức độ nghiêm trọng của một dòng, mà ở **bán kính**.

Một cast dừng lại ở dòng đó. `any` thì **đi theo**: mọi property đọc ra từ nó là `any`, mọi giá trị
suy ra từ nó là `any`, và việc xoá kiểu chạm tới cả những file chưa bao giờ nhắc tới nó. Người sau
đọc một file sạch sẽ, thấy một biến có kiểu, và không có cách nào biết rằng kiểu đó đã bị bỏ kiểm từ
ba file trước.

Cách viết đúng khi hình dạng thật sự chưa biết là `unknown`. `unknown` không nói dối: nó nói "chưa
biết", và nó **bắt** việc thu hẹp phải xảy ra ở đâu đó, giữa thanh thiên bạch nhật.

**Dấu hiệu nhận biết**

- `: any`, `<any>`, `as any`, `Array<any>`, `Record<string, any>`.
- Một hàm nhận `any` rồi trả về thứ gì đó có kiểu, mà **không** có bước kiểm nào ở giữa.
- Lý do được nêu là *tạm thời*, *sẽ sửa sau*, *chỗ này generic quá*.

**Tự hỏi.** Nếu đổi `any` này thành `unknown`, có bao nhiêu chỗ đỏ lên? Mỗi chỗ đỏ là một chỗ đang
tin vào một điều chưa ai kiểm.

**Ranh giới**

- ↔ `TYPE-SAFETY-1`: xem trên. Nếu chọn được, hãy chọn mã có **bán kính đúng**: một dòng thì là
  `TYPE-SAFETY-1`, một kiểu lan đi thì là `TYPE-SAFETY-2`.
- ↔ `TYPE-SAFETY-5`: `any` **không** được cứu bằng một lý do. Lý do biện hộ cho việc bắc cầu tại một
  điểm; `any` không phải một điểm.

**Tình huống nghiệp vụ hay gặp.** Wrapper quanh một client HTTP · handler nhận payload của webhook ·
adapter dịch dữ liệu vendor · hàm util "dùng chung" đã mất kiểu từ lâu · props tạm của một component
mới dựng.

---

## `TYPE-SAFETY-3` — một thứ, một cách viết

**Tình huống.** `Array<T>` và `T[]` **nghĩa y hệt nhau**. Đó chính xác là lý do đây là một luật chứ
không phải một sở thích: khi hai cách viết cùng đúng, không có thứ gì sửa cách thứ hai cả. File viết
hôm thứ Ba đọc khác file bên cạnh, và mọi diff sau đó mang thêm tiếng ồn không nói gì về nghiệp vụ.

Chọn dạng generic vì nó là dạng **còn đọc được khi kiểu phần tử tự nó cũng generic**. So `Array<Map<string, Set<number>>>`
với `Map<string, Set<number>>[]`: ở dạng hậu tố, cặp ngoặc nói "đây là mảng" bị đẩy ra tận cuối, sau
khi mắt đã phải giải xong hai tầng generic khác.

**Dấu hiệu nhận biết**

- `T[]` hoặc `readonly T[]` trong một file `.ts`/`.tsx`.
- Hai cách viết cùng tồn tại trong **một** file.

**Tự hỏi.** Nếu kiểu phần tử ngày mai trở thành generic, dòng này còn đọc được không?

**Ranh giới**

- ↔ mọi mã khác: đây là mã duy nhất **không** nói về việc tắt kiểm. Không có gì bị xoá cả; hệ kiểu
  vẫn làm việc như thường. Nó ở trong module này vì cùng một lý do gốc — thứ không có ai sửa thì sẽ
  trôi.

**Tình huống nghiệp vụ hay gặp.** Kiểu dữ liệu của một component · kết quả query · tham số rest của
một handler · union chứa mảng lồng · kiểu readonly của contract.

---

## `TYPE-SAFETY-4` — test được phép dựng giá trị sai, vì đó là việc của nó

**Tình huống.** Cần chứng minh rằng một API đã đóng kiểu **từ chối** đầu vào sai. Muốn chứng minh
điều đó thì phải **dựng ra** đầu vào sai — và không có cách nào dựng một giá trị mà kiểu cấm, ngoài
việc bảo trình biên dịch quên kiểu đi.

Đây là mã duy nhất trong module nói **được phép**. Nó tồn tại chính để chữ **không** ở
`TYPE-SAFETY-1` được tuyệt đối ở mọi nơi khác.

**Miễn trừ này là một ĐƯỜNG DẪN, và bắt buộc phải là đường dẫn.** Một miễn trừ dựa trên phán đoán —
"khi nào thật sự cần thì được" — sẽ bị đem ra cãi ở **từng** call site, và bên cãi luôn là bên đang
vội. Một đường dẫn thì cãi **một lần**, ở đây.

**Dấu hiệu nhận biết**

- File kết thúc bằng `.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`.
- Giá trị được dựng là một fake **cố tình thiếu**: đủ để hàm dưới test chạm tới, không đủ để khớp
  kiểu thật.
- Xung quanh có một câu làm rõ file này đang canh điều gì.

**Tự hỏi.** Giá trị sai này có phải **chính là thứ đang được chứng minh** không? Nếu chỉ là dựng
fixture cho nhanh thì miễn trừ không áp dụng — nó chỉ đang mượn quyền của một mã khác.

**Ranh giới**

- ↔ `TYPE-SAFETY-1`: cùng cú pháp, khác file. Đây là toàn bộ khác biệt, và cũng là lý do miễn trừ
  phải là đường dẫn chứ không phải lời hứa.
- ↔ `TYPE-SAFETY-5`: trong test, lý do **không** phải điều kiện để cast tồn tại. Nhưng một câu nói
  file đang canh gì vẫn là thứ khiến người sau đọc được, và đó là thói quen chứ không phải luật.
- **Một file test không tự động sạch.** Miễn trừ chỉ nói: dựng giá trị sai ở đây không phải lỗi. Nó
  **không** nói mọi cast trong test đều đúng. Cast trong test vì lười vẫn là cast vì lười — chỉ là
  không có gì báo cáo nó.

**Tình huống nghiệp vụ hay gặp.** Fake một operation của transport link · dựng response thiếu field
bắt buộc · ép một `undefined` vào chỗ khai là `Error` để xem nhánh phòng thủ có chạy · mock một
module vendor bằng những mảnh tối thiểu · dựng một state không hợp lệ để kiểm guard.

---

## `TYPE-SAFETY-5` — cast sống sót thì mang theo lý do

**Tình huống.** Đôi khi một biên **thật sự** cần một cast: kiểu vendor khai sai, một giá trị mà
runtime bảo đảm còn trình biên dịch thì không, một implementation rộng hơn mọi overload của chính nó.
Những trường hợp đó có thật.

Thứ tách chúng khỏi phần còn lại không phải mức độ tự tin của người viết, mà là: **lý do viết ra
được thành một mệnh đề**. Và phép thử ấy mạnh hơn vẻ ngoài của nó. Khi ép mình viết câu đó ra, phần
lớn cast sẽ tự hỏng: câu duy nhất viết được là "vì nếu không thì nó báo lỗi" — mà lỗi ấy chính là
trình biên dịch đang nói một điều **đúng**.

**Dấu hiệu nhận biết**

- Cast một tầng, không xuyên `unknown`.
- Bên cạnh có một câu nêu **điều runtime bảo đảm** hoặc **điều vendor khai sai**, không phải nêu lại
  cast đang làm gì.
- Sau cast vẫn còn một bước kiểm — cast chỉ mở đủ chỗ để kiểm, không thay cho kiểm.

**Tự hỏi.** Viết lý do ra thành một câu đi. Nếu câu ấy là "vì nó báo lỗi" thì cast này thuộc về
`TYPE-SAFETY-1` hoặc thuộc về một sửa đổi hình dạng, không thuộc về đây.

**Ranh giới**

- ↔ `TYPE-SAFETY-1`: lý do **không** cứu được cast xuyên `unknown`. Xoá kiểu kèm giải thích vẫn là
  xoá kiểu.
- ↔ `TYPE-SAFETY-2`: lý do cũng không cứu được `any`, vì `any` không dừng ở dòng có lý do ấy.
- ↔ `TYPE-SAFETY-4`: trong test, cast không cần xin phép; ngoài test, nó cần.

**Không có rule nào giữ mã này, và không thể có.** Máy nhìn thấy comment tồn tại, nhưng không nhìn
thấy comment **đúng**. Một rule đòi "phải có comment" sẽ được thoả mãn bởi chữ `// cast`. Đây là chỗ
duy nhất trong module mà người đọc là cơ chế duy nhất.

**Tình huống nghiệp vụ hay gặp.** Implementation của một factory có overload · claim công khai đã
decode từ token · một `.d.ts` vendor thiếu field mà runtime luôn gửi · một literal cần bảo toàn
kiểu hẹp · một branded type dựng ở đúng một chỗ đã kiểm.

---

## Luật

1. Cast là **xoá**, không phải thu hẹp. Thu hẹp là lời khai mà trình biên dịch còn kiểm được một
   phần.
2. Không `as unknown as` trong source sản phẩm dưới `/src/`.
3. Hình dạng chưa biết thì khai `unknown`, không khai `any`. `unknown` buộc việc thu hẹp phải xảy ra
   ở chỗ nhìn thấy được.
4. Một thứ một cách viết: `Array<T>`, `ReadonlyArray<T>`.
5. Miễn trừ cho test là một **đường dẫn**, không phải một phán đoán.
6. Cast tồn tại ngoài test thì mang lý do trong một mệnh đề ngay bên cạnh; không viết được câu ấy thì
   bỏ cast.
7. Trong hai mã cùng khớp, chọn mã có **bán kính đúng**: một dòng là `TYPE-SAFETY-1`, một kiểu lan đi
   là `TYPE-SAFETY-2`.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **File test.** `TYPE-SAFETY-1` không áp dụng cho `.test.`/`.spec.`. Đó là `TYPE-SAFETY-4`, và nó
  hẹp vì nó là đường dẫn.
- **Ngoài `/src/`.** Tooling, config build và script nằm ngoài phạm vi `TYPE-SAFETY-1`. Luật này canh
  chương trình, không canh cỗ máy lắp ra chương trình.
- **Cast đi vào `unknown`.** `value as unknown` một mình không phải xoá kiểu theo nghĩa của
  `TYPE-SAFETY-1`. Nó đi ngược chiều: từ một kiểu không đáng tin sang một kiểu không dùng được nếu
  chưa kiểm.
- **Implementation của overload.** `TYPE-SAFETY-5` chấp nhận cast từ implementation signature sang
  chính tập overload của nó, vì tập overload mới là bề mặt được kiểm, còn implementation cố ý rộng
  hơn bất kỳ overload đơn lẻ nào.
- **Biên thật, có lý do thật.** `TYPE-SAFETY-5` chấp nhận cast bắc qua một kiểu vendor sai hoặc một
  bảo đảm của runtime — với điều kiện lý do nằm ngay bên cạnh và nói về **điều được bảo đảm**, không
  nói lại cast đang làm gì.
