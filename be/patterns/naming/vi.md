---
id: be-patterns-naming-vi
title: vi.md
slug: /be/patterns/naming/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống NAME-N, nhận diện bằng nghiệp vụ chứ không bằng cảm giác tên đẹp hay xấu.
---

# vi.md

> Version: `2.00` · Module: `naming`

# Naming

Tên là **phần duy nhất** của một symbol chạm tới người đọc chưa mở nó ra. Signature, thân hàm, test
— muốn biết đều phải mở một file. Tên thì hiện ra miễn phí ở mọi call site, mọi import list, mọi lần
grep.

Nên một cái tên chỉ trả lời một câu:

> Đây là **cái gì**, với người chưa biết gì về nó?

Không phải nó được cài đặt bằng gì, không phải nó viết cho đời schema nào, không phải nó nằm ở thư
mục nào lúc được tạo ra. Cả ba thứ đó đều đổi, và một cái tên gói một trong ba thứ đó vào sẽ **thành
lời nói dối mà không có gì đỏ lên**.

Phép thử chốt một cái tên:

> Nó có còn đúng sau **lần thay đổi hợp lý kế tiếp** không?

Một cái tên buộc phải đổi khi schema lên đời sau, khi thư mục bị dời, khi cơ chế bị thay, hoặc khi
xuất hiện caller thứ hai — thì nó chưa bao giờ đặt tên cho **vật**; nó đang mô tả một **thời điểm**.

**Đây là luật bắt buộc.** Mọi symbol export, mọi file, mọi biến boolean đều rơi vào đúng một mã dưới
đây. Không có tên nào nhỏ đến mức được miễn: một helper cục bộ vẫn thuộc `NAME-5` đúng như một
service public thuộc `NAME-1`. Câu "có mỗi cái helper nội bộ thôi mà" là chỗ luật này bị bỏ qua nhiều
nhất — và helper nội bộ chính là thứ sáu tháng sau bị export ra mà không ai đọc lại tên.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Tên phải nói |
|---|---|---|
| `NAME-1` | Path đã mang vai trò và phạm vi; file chỉ còn phải gọi tên chủ thể | Chủ thể — và hậu tố file phải khớp vai trò của export |
| `NAME-2` | Có đời schema thứ hai, và cái tên đang nói về đời đó | **Tính chất** mà đời schema ấy mang lại |
| `NAME-3` | Thứ này đang nằm sau một thư mục/mount/bucket có tên | Chủ thể, không phải địa chỉ |
| `NAME-4` | Thứ này đang được sinh ra bởi một cơ chế có tên | Vật được chọn/được sinh ra, không phải cơ chế |
| `NAME-5` | Một hàm được export ra ngoài file | Động từ **kèm tân ngữ** |
| `NAME-6` | Một giá trị boolean | Một **câu hỏi** về tính chất bền |
| `NAME-7` | Một capability dùng chung, hiện mới có một nơi gọi | Chính capability đó |

---

## `NAME-1` — path mang vai trò, file gọi tên chủ thể

**Tình huống.** Symbol nằm trong một cây thư mục đã nói sẵn nó là **loại gì** và thuộc **phạm vi**
nào. Tên class là folder và file **đọc liền nhau**; file không lặp lại phần folder đã nói. Kèm theo
đó, hậu tố file phải **đồng ý** với vai trò của export: `*.service.ts` khai báo một `*Service`,
`*.handler.ts` khai báo một `*Handler`.

**Dấu hiệu nhận biết**

- Đọc `folder/file` lên thành một cụm thì ra đúng tên class.
- Xoá một từ khỏi tên file mà thông tin không mất đi — từ đó đang bị nói hai lần.
- Hậu tố hứa một vai trò, mở file ra thấy export vai trò khác.

**Tự hỏi.** Từ này đã có trong path chưa? Nếu rồi, nói lại lần nữa để làm gì?

**Ranh giới**

- ↔ `NAME-3`: `NAME-1` nói path **được phép** đóng góp vào tên; `NAME-3` cấm lấy **địa chỉ vật lý**
  (mount, bucket, thư mục hạ tầng) làm tên. Path phân loại thì đóng góp; path lưu trữ thì không.
- ↔ `NAME-7`: một folder theo bề mặt (một operation của một màn hình) là phạm vi hợp lệ của
  **operation**, không phải giấy phép đặt tên bề mặt cho một service dùng chung.

**Lịch sử đã kiểm.** Một phiên bản đầu của luật này đòi tên file phải đánh vần trọn tên class, và đo
được **616 chỗ vi phạm trên 4430 file**. Mười bốn phần trăm một cây mã không phải là nợ, đó là
**quy ước**. Luật ghi lại cái mã nguồn đang làm; rule đo được sai ở quy mô đó là rule sai.

**Tình huống nghiệp vụ hay gặp.** Cặp `path/` và `parsers/` cùng chứa một file tên giống hệt nhau ·
thư mục một operation chứa command, handler, resolver, module · thư mục một integration chứa client,
producer, consumer · thư mục `errors/<phạm vi>/` chứa từng exception.

---

## `NAME-2` — tên nói vật, không nói đời schema

**Tình huống.** Có một shape thứ hai của cùng một thứ, và người viết lấy **số đời** làm tên:
`isV2`, `IsContentV2Params`, `parseV2Body`.

**Dấu hiệu nhận biết**

- Trong tên có một chữ `V` kèm số.
- Ngay cạnh cái tên đó, biểu thức lại đang đọc **một tính chất có thật** (`Boolean(record.verified)`).
- Không ai trả lời được "V2 là đời **hiện tại** hay đời **cũ**?" mà không mở file.

**Tự hỏi.** Ngày có đời thứ ba, cái tên này phải đổi không? Và từ giờ tới lúc đó, nó nói gì?

**Ranh giới**

- ↔ `NAME-6`: `isV2` sai **hai lần**. Nó là boolean nên thuộc `NAME-6`, và nó hỏi về một đời schema
  nên thuộc `NAME-2`. Ghi nhận `NAME-2`: cái hỏng ở đây là **chủ đề câu hỏi**, không phải dạng câu.
- ↔ ngoại lệ: một cột `schemaVersion`, một đoạn `/v1/` trong đường dẫn public, một class migration
  mang số thứ tự — đó là **giá trị** phiên bản, không phải một nhánh được đặt tên theo phiên bản.

**Cái giá thật.** Không phải chuyện phải rename ngày có V3 — rename là phần dễ. Phần đắt là **từ giờ
đến lúc đó**, mọi người đọc đều phải đi tra xem "V2" nghĩa là hiện tại hay đã chết.

**Tình huống nghiệp vụ hay gặp.** Parser đọc hai định dạng nội dung · prompt input có hai thế hệ ·
payload webhook đổi shape · DTO của API cũ và mới sống song song · cờ phân nhánh trong một step
service.

---

## `NAME-3` — tên nói vật, không nói địa chỉ

**Tình huống.** Thứ này đang đọc dữ liệu từ một thư mục, một mount, một bucket có tên. Người viết lấy
**tên chỗ đứng** làm tên: `VolumeService`, `readVolumeDoc`.

**Dấu hiệu nhận biết**

- Trong tên có tên một thư mục, một mount, một bucket, một prefix hạ tầng.
- Đổi tên chỗ lưu trữ là cái tên sai ngay, nhưng **không có test nào đỏ**.
- Người mới đọc tên vẫn thấy hợp lý — và đó chính là chỗ nguy hiểm.

**Tự hỏi.** Nếu ngày mai chỗ lưu trữ đổi tên, cái tên này còn đúng không? Ai sẽ biết là nó sai?

**Ranh giới**

- ↔ `NAME-1`: path **phân loại** (`parsers/`, `path/`) là vai trò, được góp vào tên. Path **lưu trữ**
  (`.volume`, `.mount`) là địa chỉ, không được góp.
- ↔ `NAME-4`: địa chỉ là **chỗ vật nằm**; cơ chế là **cách vật được sinh ra**. Hỏng giống nhau, hỏng
  vì lý do khác nhau.

**Vết sẹo.** Một helper đọc nội dung mount tên là `VolumeService` vì thư mục lúc đó là `.volume`. Thư
mục đã bị đổi tên **hai lần** kể từ đó. Suốt hai lần rename, cái helper mang tên một đường dẫn không
còn tồn tại, và không có gì báo. Tệ hơn: hằng số path hỏng chỉ làm suite **skip**, nên lane vẫn báo
xanh trong khi không chạy gì cả.

**Tình huống nghiệp vụ hay gặp.** Helper đọc content mount · service đọc file seed · adapter đọc
object storage · util đọc thư mục snapshot · loader đọc thư mục migration.

---

## `NAME-4` — tên nói vật, không nói cơ chế

**Tình huống.** Thứ này hiện được chọn/được sinh ra bởi một cơ chế có tên — một bảng phân hạng, một
chuỗi fallback, một thuật toán định tuyến. Người viết lấy **tên cơ chế** làm tên.

**Dấu hiệu nhận biết**

- Tên nói về cách chọn, không nói về **thứ được chọn**.
- Đọc hết một cụm biến quanh đó, không cái nào nói ra được **vật** cuối cùng là gì.
- Bỏ cơ chế đi thì **cả cụm tên sai cùng một lúc**.

**Tự hỏi.** Nếu thay cơ chế mà giữ nguyên kết quả, cái tên này còn đúng không?

**Ranh giới**

- ↔ `NAME-3`: xem trên.
- ↔ ngoại lệ: một module integration mà **công việc của nó chính là** một hệ thống ngoài thì được
  mang tên hệ thống đó — lúc ấy cơ chế **là** chủ thể. Cái bị từ chối là đặt tên một **capability
  nghiệp vụ** theo hạ tầng nó đang cưỡi.

**Vì sao mã này nặng hơn vẻ ngoài.** `NAME-2` và `NAME-3` sai **từng cái một**. `NAME-4` sai **cả
vùng**: khi cơ chế biến mất, mọi tên quanh nó sai đồng loạt, vì chưa từng có tên nào nói ra vật thật.

**Tình huống nghiệp vụ hay gặp.** Bảng phân hạng chọn model · chuỗi fallback nhà cung cấp · pool
key · chiến lược retry · thuật toán phân phối tải · cơ chế cache đứng trước một phép tính.

---

## `NAME-5` — hàm export là động từ kèm tân ngữ

**Tình huống.** Một hàm được export ra khỏi file. Ở import list, người đọc chỉ thấy **cái tên** —
không thấy thân hàm, không thấy signature.

**Dấu hiệu nhận biết**

- Tên là một động từ trần: `generate`, `parse`, `run`, `handle`, `build`.
- Đọc dòng import lên, phải nhìn sang **path** mới đoán được nó làm gì.
- Hai module cùng export một động từ trần thì import list phải đặt alias.

**Tự hỏi.** `generate` **cái gì**? Nếu phải nhìn path mới trả lời được thì path đang làm việc của tên
— và `NAME-3` đã nói vì sao path là thứ hay dời.

**Ranh giới**

- ↔ `NAME-6`: hàm trả về boolean thì không lấy động từ + tân ngữ, mà lấy **câu hỏi** — đó là
  `NAME-6`.
- ↔ ngoại lệ: mã này quản **export**. Một helper private đọc cách thân hàm ba dòng thì được là động
  từ trần; đúng lúc nó được export ra, nó phải có tân ngữ.

**Chú ý.** Luật cấm **động từ trần**, không cấm động từ. `resolveGradingChain` hợp lệ dù `resolve`
nằm trong danh sách cấm, vì nó đã có tân ngữ.

**Tình huống nghiệp vụ hay gặp.** Helper trong thư mục `utils/` · factory dựng payload · hàm chuẩn
hoá điểm · hàm ước lượng chi phí · hàm dựng chuỗi fallback · helper dùng chung trong test.

---

## `NAME-6` — boolean là một câu hỏi về tính chất bền

**Tình huống.** Giá trị trả về là `boolean`. Tên phải đọc lên thành một **câu hỏi**: `isX`, `hasX`,
`canX`.

**Dấu hiệu nhận biết**

- Kiểu trả về là `boolean` hoặc `Promise<boolean>`.
- Tên bắt đầu bằng `check` — nghe như **đi làm** việc kiểm tra chứ không phải **trả lời**.
- Tên kết thúc bằng `Flag` — không nói được nó cờ **cái gì**.

**Tự hỏi.** Đọc cái tên này lên có thành một câu hỏi trả lời được bằng có/không không? Và câu hỏi đó
hỏi về **tính chất** hay về một **đời schema**?

**Ranh giới**

- ↔ `NAME-2`: dạng câu đúng nhưng chủ đề sai vẫn là `NAME-2`. `isV2` là boolean hỏi về một đời
  schema; `hasVerifiedMarker` là boolean hỏi về một tính chất.
- ↔ `NAME-5`: một hàm **thật sự đi làm việc gì đó** rồi trả về kết quả không phải boolean thì được
  mang động từ. `checkEligible` trả về những hạng đã đạt — nó làm việc thật, và nó **không** phải
  vi phạm mã này.

**Vì sao "tính chất bền" chứ không chỉ "tính chất".** Một câu hỏi đúng dạng nhưng hỏi về thứ tạm bợ
(`isCurrentlyInBatch`) sẽ chết cùng thứ tạm bợ đó. Câu hỏi phải hỏi về thứ còn sống sau lần thay đổi
kế tiếp.

**Tình huống nghiệp vụ hay gặp.** Kiểm tra đã ghi danh chưa · kiểm tra còn hạn gói cước · kiểm tra
đã bật seeder chưa · kiểm tra có nội dung trong snapshot chưa · kiểm tra quyền của một vai trò.

---

## `NAME-7` — tên nói capability, không nói người gọi đầu tiên

**Tình huống.** Một capability dùng chung được đặt tên theo **bề mặt đã đặt hàng nó đầu tiên**:
`DashboardContentService`.

**Dấu hiệu nhận biết**

- Trong tên một service dùng chung có tên một màn hình, một trang, một tab.
- Nó nằm ở tầng dùng chung nhưng chỉ có đúng một nơi gọi — hiện tại.
- Ngày có nơi gọi thứ hai, nó **vẫn chạy** và **vẫn nói sai**.

**Tự hỏi.** Nếu ngày mai một bề mặt khác cần đúng thứ này, cái tên có trở thành sai không? Nó có báo
gì không?

**Ranh giới**

- ↔ `NAME-1`: một thư mục operation **theo bề mặt** là phạm vi hợp lệ của chính operation đó. Cái bị
  cấm là mang tên bề mặt sang một service dùng chung.
- ↔ ngoại lệ: nếu chữ trông giống tên người gọi thật ra **là khái niệm nghiệp vụ** — một read model
  của đúng bề mặt ấy — thì đó là chủ thể, không phải người đặt hàng.

**Vì sao mã này khó thấy nhất.** Sáu mã kia sai vì một thứ đã đổi. Mã này sai vì một thứ **được thêm
vào**, và thêm vào thì không ai đi đọc lại tên cũ.

**Tình huống nghiệp vụ hay gặp.** Service tổng hợp số liệu ban đầu chỉ có một trang dùng · helper
định dạng ban đầu chỉ có một email dùng · projection ban đầu chỉ có một widget đọc · query builder
ban đầu chỉ có một tab gọi.

## Luật

1. Path mang **vai trò** và **phạm vi**; file gọi tên **chủ thể**; hậu tố file khớp vai trò của
   export.
2. Không gói **đời schema** vào tên. Gọi tên **tính chất** mà đời đó mang lại.
3. Không gói **địa chỉ lưu trữ** vào tên. Gọi tên chủ thể.
4. Không gói **cơ chế** vào tên. Gọi tên vật được chọn hoặc được sinh ra.
5. Hàm export là **động từ kèm tân ngữ**.
6. Boolean là **câu hỏi**, và câu hỏi ấy hỏi về **tính chất bền**.
7. Không lấy **người gọi đầu tiên** làm định ngữ cho một capability.
8. Chốt mọi tên bằng một câu: **nó còn đúng sau lần thay đổi hợp lý kế tiếp chứ?**

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp vào.

- **Cơ chế chính là chủ thể** (`NAME-4`). Một module integration mà toàn bộ việc của nó là một hệ
  thống ngoài thì mang tên hệ thống đó. Cái bị từ chối là đặt tên **capability nghiệp vụ** theo hạ
  tầng nó đang chạy trên.
- **Phiên bản chính là giá trị** (`NAME-2`). Một cột `schemaVersion`, một đoạn `/v1/` trong đường dẫn
  public, một class migration mang số thứ tự — đó là dữ liệu, không phải một nhánh được đặt tên theo
  số đời.
- **Thư mục chính là chủ thể** (`NAME-1`). File khai báo module của đúng thư mục nó đứng thì được
  trùng chữ với thư mục, vì nó không còn tên nào khác để mang.
- **Động từ trần trong phạm vi file** (`NAME-5`). Mã này quản export. Helper private đọc ngay cạnh
  thân hàm được là động từ trần; export ra là phải có tân ngữ.
- **Bề mặt chính là miền nghiệp vụ** (`NAME-7`). Nếu chữ trông giống tên người gọi thật ra là khái
  niệm nghiệp vụ — một read model dựng riêng cho đúng bề mặt ấy — thì nó đang gọi tên chính nó.
