---
title: Naming · Vietnamese
description: Một shape đã duyệt hạ xuống source ở đâu, và cái tên được khai báo ở đó phải nói gì.
module: naming
kind: pattern
stack: be
codes: [NAME-1, NAME-2, NAME-3, NAME-4, NAME-5, NAME-6, NAME-7]
---

# Đặt tên

Đầu vào là một shape đã có người duyệt — một capability, một operation, một contract, một helper mà
thiết kế đã chốt là có. Pattern này không mở lại quyết định đó. Đầu ra của nó là kiến trúc source:
thư mục nào giữ symbol, nó nằm ở file nào, file ấy mang hậu tố gì, và symbol được khai báo tên là gì
khi đã nằm đúng chỗ. Tên là phần duy nhất của một symbol đến được với người đọc trước khi họ mở file,
nên hạ một shape xuống sai chỗ không phải mất mát hình thức — đó là shape nói dối ở mọi call site.

## Luật

Tên là **phần duy nhất** của một symbol đến được với người đọc trước khi họ mở file. Signature, thân
hàm, test — muốn biết đều phải mở một file. Tên thì hiện ra miễn phí ở mọi call site, mọi import list,
mọi lần grep.

Nên một cái tên chỉ trả lời một câu: đây là **cái gì**, với người chưa biết gì về nó? Tên không nói về
cách cài đặt, không nói đời schema mà nó phục vụ, không nói thư mục lúc nó được tạo ra. Cả ba thứ đó
đều đổi, và một cái tên gói một trong ba thứ đó vào sẽ **thành lời nói dối mà không có gì đỏ lên**.

Phép thử chốt một cái tên: **nó có còn đúng sau lần thay đổi hợp lý kế tiếp không?** Một cái tên buộc
phải đổi khi schema lên đời sau, khi thư mục bị dời, khi cơ chế bị thay, hoặc khi xuất hiện caller thứ
hai — thì nó chưa bao giờ đặt tên cho **vật**; nó đang mô tả một **thời điểm**.

**Đây là luật bắt buộc, không phải lời khuyên.** Mọi symbol export, mọi file, mọi biến boolean đều
thuộc đúng một mã dưới đây. Không có tên nào nhỏ đến mức được miễn: một helper cục bộ vẫn thuộc
`NAME-5` đúng như một service public thuộc `NAME-1`. Câu "chỉ là helper nội bộ thôi mà" là chỗ luật này
bị bỏ qua nhiều nhất — và helper nội bộ chính là thứ sáu tháng sau bị export ra mà không ai đọc lại tên.

Phần lớn luật này máy không kiểm được, và đó là lý do nó được viết kèm sẹo. Hai trong bảy mã có một
lint rule đứng sau; năm mã còn lại chỉ có một người đọc.

## Mã tình huống

Mỗi tình huống module này quản đều mang một mã, `NAME-<n>`. Các con số là CỐ ĐỊNH: chúng được trích dẫn
từ các luật anh em và từ các bản ghi task cũ, nên đánh số lại là lặng lẽ làm hỏng một trích dẫn ai đó
đã viết.

| Mã | Tình huống | Source phải trông như thế nào |
|---|---|---|
| `NAME-1` | Path đã mang vai trò và phạm vi; file chỉ còn phải gọi tên chủ thể | Path mang vai trò và phạm vi; file gọi tên chủ thể; symbol được khai báo là hai phần ấy đọc liền nhau, và hậu tố file đồng ý với vai trò của export (`*.service.ts` khai báo một `*Service`, `*.handler.ts` một `*Handler`). Cấm: lặp lại vai trò hoặc phạm vi của folder ngay trong tên file; một hậu tố hứa vai trò mà export không có |
| `NAME-2` | Có đời schema thứ hai, và cái tên đang nói về đời đó | Tên gọi ra **tính chất**, để nó sống sót qua chính cái đời đã sinh ra nó. Cấm: gói một đời schema vào identifier (`isV2`, `V2Params`, `parseV2Body`) |
| `NAME-3` | Thứ này đang nằm sau một thư mục, mount hay bucket có tên | Tên gọi ra chủ thể. Cấm: lấy thư mục, mount, bucket hay đường dẫn mà thứ đó **hiện đang** nằm sau làm tên |
| `NAME-4` | Thứ này đang được sinh ra bởi một cơ chế có tên | Tên gọi ra vật được chọn, được sinh ra hoặc được đo. Cấm: lấy cơ chế hiện đang sinh ra nó làm tên |
| `NAME-5` | Một hàm được export ra khỏi file | Hàm export là một động từ **kèm tân ngữ**. Cấm: export một động từ trần (`generate`, `parse`, `run`) khiến người đọc phải quay lại nhìn path |
| `NAME-6` | Một giá trị boolean | Boolean là một **câu hỏi** — `isX`, `hasX`, `canX` — về một tính chất bền. Cấm: `checkX`, đọc lên như đang đi làm việc kiểm tra; `xFlag`, không gọi tên được gì; và một câu hỏi về đời schema thay vì về tính chất |
| `NAME-7` | Một capability dùng chung, hiện mới có đúng một nơi gọi | Tên gọi ra chính capability đó. Cấm: lấy bề mặt đầu tiên yêu cầu nó làm định ngữ |

Bảy mã, và dừng ở bảy. Một tình huống thật sự không có mã nào là một thay đổi luật được ghi nhận,
không phải một con số thứ tám thêm vào cho tiện.

`NAME-2`, `NAME-3` và `NAME-4` là một câu nói ba lần trước ba thứ thay thế hấp dẫn khác nhau, và chúng
vẫn là ba mã vì ba thứ ấy hỏng theo ba kiểu: phiên bản sai **theo lịch**, path sai vào **đúng ngày** có
người khác chạy rename, còn cơ chế sai **một lượt**, kéo theo mọi cái tên bên cạnh.

## Đọc một shape đã duyệt

1. **Đọc xem shape nói ra cái gì.** Nó nói chủ thể — capability, operation, giá trị đang được tính. Nó
   nói vai trò: service, handler, resolver, module, util, constant, predicate. Nó nói phạm vi symbol
   đứng dưới. Ba thứ đó là đầu vào để dựng tên.
2. **Đọc xem shape KHÔNG nói gì, và từ chối giải quyết chỗ đó.** Một shape đã duyệt không nói payload
   đang ở đời schema nào, không nói dữ liệu hiện nằm sau mount nào, không nói cơ chế nào đang sinh ra
   giá trị, cũng không nói bề mặt nào sẽ gọi nó thứ hai. Bốn thứ đó đúng là bốn thứ thay thế mà
   `NAME-2`, `NAME-3`, `NAME-4` và `NAME-7` từ chối. Shape im lặng về chúng thì cái tên cũng im lặng
   về chúng — một sự thật shape không nói ra thì không được gói vào một cái tên sống lâu hơn nó.
3. **Giải từ ngoài vào trong.** Folder trước file, file trước symbol, symbol trước thành viên. Folder
   quyết vai trò và phạm vi, nên file chỉ thêm chủ thể (`NAME-1`); hậu tố file một khi đã chốt thì ràng
   buộc vai trò của export, và chỉ sau đó identifier mới được chọn. Chọn identifier trước chính là cách
   một chữ của folder bị nói hai lần.
4. **Hỏi lần lượt câu hỏi của từng mã.** `NAME-1`: từ này đã có trong path chưa? `NAME-2`: ngày có đời
   thứ ba, tên này phải đổi không — và từ giờ tới lúc đó nó nói gì? `NAME-3`: nếu ngày mai chỗ lưu trữ
   đổi tên, tên này còn đúng không, và ai sẽ biết là nó sai? `NAME-4`: nếu thay cơ chế mà giữ nguyên
   kết quả, tên này còn đúng không? `NAME-5`: `generate` **cái gì**? `NAME-6`: đọc lên có thành một câu
   hỏi có/không không, và câu hỏi ấy hỏi về **tính chất** hay về một **đời schema**? `NAME-7`: nếu ngày
   mai một bề mặt khác cần đúng thứ này, tên có trở thành sai không, và có gì báo không?
5. **Khi hai mã cùng khớp, chủ đề của cái hỏng quyết định.** `isV2` sai **hai lần**: nó là boolean nên
   `NAME-6` khớp, và nó hỏi về một đời schema nên `NAME-2` khớp. Ghi nhận `NAME-2` — cái hỏng ở đây là
   **chủ đề câu hỏi**, không phải dạng câu. Thứ tự ấy chạy ở mọi chỗ khác: một chữ sai bên trong tên
   đứng trên một dạng tên sai.

## `NAME-1` — path mang vai trò, file gọi tên chủ thể

**Tình huống.** Symbol nằm trong một cây thư mục đã nói sẵn nó là **loại gì** và thuộc **phạm vi** nào.
Tên class là folder và file **đọc liền nhau**; file không lặp lại phần folder đã nói. Kèm theo đó, hậu
tố file phải **đồng ý** với vai trò của export: `*.service.ts` khai báo một `*Service`, `*.handler.ts`
khai báo một `*Handler`.

**Nó sinh ra gì trong source.** Một folder mang vai trò và phạm vi, một file chỉ thêm chủ thể vào tên,
một hậu tố khớp vai trò của export, và một symbol khai báo là folder cộng file đọc liền nhau.

**Dấu hiệu nhận biết.** Đọc `folder/file` lên thành một cụm thì ra đúng tên class. Xoá một từ khỏi tên
file mà thông tin không mất đi — từ đó đang bị nói hai lần. Hậu tố hứa một vai trò, mở file ra thấy
export vai trò khác.

**Ranh giới.** Không phải `NAME-3`: `NAME-1` nói path **được phép** đóng góp vào tên, còn `NAME-3` cấm
lấy **địa chỉ vật lý** — mount, bucket, thư mục hạ tầng — làm tên. Path phân loại thì đóng góp; path
lưu trữ thì không. Không phải `NAME-7`: một folder theo bề mặt (một operation của một màn hình) là phạm
vi hợp lệ của **chính operation đó**, không phải giấy phép đặt tên bề mặt cho một service dùng chung.

Lịch sử đã kiểm: một phiên bản đầu của luật này đòi tên file phải đánh vần trọn tên class, và đo được
**616 chỗ vi phạm trên 4430 file**. Mười bốn phần trăm một cây mã không phải là nợ, đó là **quy ước**.
Luật ghi lại cái mã nguồn đang làm; rule đo được sai ở quy mô đó là rule sai.

**Tình huống nghiệp vụ hay gặp.** Cặp `path/` và `parsers/` cùng chứa một file tên giống hệt nhau · thư
mục một operation chứa command, handler, resolver, module · thư mục một integration chứa client,
producer, consumer · thư mục `errors/<phạm vi>/` chứa từng exception.

## `NAME-2` — tên nói vật, không nói đời schema

**Tình huống.** Có một shape thứ hai của cùng một thứ, và người viết lấy **số đời** làm tên: `isV2`,
`IsContentV2Params`, `parseV2Body`.

**Nó sinh ra gì trong source.** Một identifier gọi tên tính chất mà đời ấy mang lại — thứ thật sự đúng
về giá trị đó — nên identifier sống sót qua chính cái đời đã gợi ra nó.

**Dấu hiệu nhận biết.** Trong tên có một chữ `V` kèm số. Ngay cạnh cái tên đó, biểu thức lại đang đọc
**một tính chất có thật** (`Boolean(record.verified)`). Không ai trả lời được "V2 là đời **hiện tại**
hay đời **cũ**?" mà không mở file.

**Ranh giới.** Không phải `NAME-6`: `isV2` sai **hai lần** — nó là boolean nên `NAME-6` khớp, và nó hỏi
về một đời schema nên `NAME-2` khớp. Ghi nhận `NAME-2`, vì cái hỏng là **chủ đề câu hỏi**, không phải
dạng câu. Cũng không phải ngoại lệ: một cột `schemaVersion`, một đoạn `/v1/` trong đường dẫn public,
một class migration mang số thứ tự — đó là **giá trị** phiên bản, không phải một nhánh được đặt tên
theo phiên bản.

Cái giá thật không nằm ở lần rename ngày có V3 — rename là phần dễ. Phần đắt là **từ giờ đến lúc đó**,
mọi người đọc đều phải đi tra xem "V2" nghĩa là hiện tại hay đã chết.

**Tình huống nghiệp vụ hay gặp.** Parser đọc hai định dạng nội dung · prompt input có hai thế hệ ·
payload webhook đổi shape · DTO của API cũ và mới sống song song · cờ phân nhánh trong một step service.

## `NAME-3` — tên nói vật, không nói địa chỉ

**Tình huống.** Thứ này đang đọc dữ liệu từ một thư mục, một mount, một bucket có tên, và người viết lấy
**tên chỗ đứng** làm tên: `VolumeService`, `readVolumeDoc`.

**Nó sinh ra gì trong source.** Một identifier gọi tên tài liệu, bản ghi hay chủ thể đang được đọc, còn
chỗ lưu trữ chỉ xuất hiện trong hằng số path mà nó giải ra — không bao giờ trong tên export.

**Dấu hiệu nhận biết.** Trong tên có tên một thư mục, một mount, một bucket, một prefix hạ tầng. Đổi tên
chỗ lưu trữ là cái tên sai ngay, nhưng **không có test nào đỏ**. Người mới đọc tên vẫn thấy hợp lý — và
đó chính là chỗ nguy hiểm.

**Ranh giới.** Không phải `NAME-1`: path **phân loại** (`parsers/`, `path/`) là vai trò, được góp vào
tên; path **lưu trữ** (`.volume`, `.mount`) là địa chỉ, không được góp. Không phải `NAME-4`: địa chỉ là
**chỗ vật nằm**; cơ chế là **cách vật được sinh ra**. Hỏng giống nhau, hỏng vì lý do khác nhau.

Vết sẹo: một helper đọc nội dung mount tên là `VolumeService` vì thư mục lúc đó là `.volume`. Thư mục đã
bị đổi tên **hai lần** kể từ đó. Suốt hai lần rename, cái helper mang tên một đường dẫn không còn tồn
tại, và không có gì báo. Tệ hơn: hằng số path hỏng chỉ làm suite **skip**, nên lane vẫn báo xanh trong
khi không chạy gì cả.

**Tình huống nghiệp vụ hay gặp.** Helper đọc content mount · service đọc file seed · adapter đọc object
storage · util đọc thư mục snapshot · loader đọc thư mục migration.

## `NAME-4` — tên nói vật, không nói cơ chế

**Tình huống.** Thứ này hiện được chọn hoặc được sinh ra bởi một cơ chế có tên — một bảng phân hạng, một
chuỗi fallback, một thuật toán định tuyến — và người viết lấy **tên cơ chế** làm tên.

**Nó sinh ra gì trong source.** Một identifier gọi tên thứ được chọn, được sinh ra hoặc được đo — một
trọng số model, phần credit một lời gọi điển hình tiêu tốn — nên thay cơ chế cũng không làm tên sai.

**Dấu hiệu nhận biết.** Tên nói về cách chọn, không nói về **thứ được chọn**. Đọc hết một cụm biến quanh
đó, không cái nào nói ra được **vật** cuối cùng là gì. Bỏ cơ chế đi thì **cả cụm tên sai cùng một lúc**.

**Ranh giới.** Không phải `NAME-3`: xem trên — địa chỉ so với cách sinh ra. Không phải ngoại lệ: một
module integration mà **toàn bộ việc của nó chính là** một hệ thống ngoài thì được mang tên hệ thống đó,
vì lúc ấy cơ chế **là** chủ thể. Cái bị từ chối là đặt tên một **capability nghiệp vụ** theo hạ tầng nó
đang cưỡi.

Vì sao mã này nặng hơn vẻ ngoài: `NAME-2` và `NAME-3` sai **từng cái một**. `NAME-4` sai **cả vùng**:
khi cơ chế biến mất, mọi tên quanh nó sai đồng loạt, vì chưa từng có tên nào nói ra vật thật.

**Tình huống nghiệp vụ hay gặp.** Bảng phân hạng chọn model · chuỗi fallback nhà cung cấp · pool key ·
chiến lược retry · thuật toán phân phối tải · cơ chế cache đứng trước một phép tính.

## `NAME-5` — hàm export là động từ kèm tân ngữ

**Tình huống.** Một hàm được export ra khỏi file. Ở import list, người đọc chỉ thấy **cái tên** — không
thấy thân hàm, không thấy signature.

**Nó sinh ra gì trong source.** Một identifier export là động từ đã gắn tân ngữ, để riêng dòng import đã
nói được hàm làm gì mà không phải tra path.

**Dấu hiệu nhận biết.** Tên là một động từ trần: `generate`, `parse`, `run`, `handle`, `build`. Đọc dòng
import lên, phải nhìn sang **path** mới đoán được nó làm gì. Hai module cùng export một động từ trần thì
import list phải đặt alias.

**Ranh giới.** Không phải `NAME-6`: hàm trả về boolean thì không lấy động từ kèm tân ngữ, mà lấy **câu
hỏi** — đó là `NAME-6`. Không phải ngoại lệ: mã này quản **export**. Một helper private đọc cách thân
hàm ba dòng thì được là động từ trần; đúng lúc nó được export ra, nó phải có tân ngữ.

Chú ý: luật cấm **động từ trần**, không cấm động từ. `resolveGradingChain` hợp lệ dù `resolve` nằm trong
danh sách cấm, vì nó đã có tân ngữ.

**Tình huống nghiệp vụ hay gặp.** Helper trong thư mục `utils/` · factory dựng payload · hàm chuẩn hoá
điểm · hàm ước lượng chi phí · hàm dựng chuỗi fallback · helper dùng chung trong test.

## `NAME-6` — boolean là một câu hỏi về tính chất bền

**Tình huống.** Giá trị trả về là `boolean`. Tên phải đọc lên thành một **câu hỏi**: `isX`, `hasX`,
`canX`.

**Nó sinh ra gì trong source.** Một predicate mà identifier đọc lên thành câu hỏi có/không về một tính
chất còn sống lâu hơn lý do nó được thêm vào.

**Dấu hiệu nhận biết.** Kiểu trả về là `boolean` hoặc `Promise<boolean>`. Tên bắt đầu bằng `check` —
nghe như **đi làm** việc kiểm tra chứ không phải **trả lời**. Tên kết thúc bằng `Flag` — không nói được
nó cờ **cái gì**.

**Ranh giới.** Không phải `NAME-2`: dạng câu đúng nhưng chủ đề sai vẫn là `NAME-2`. `isV2` là boolean
hỏi về một đời schema; `hasVerifiedMarker` là boolean hỏi về một tính chất. Không phải `NAME-5`: một hàm
**thật sự đi làm việc gì đó** rồi trả về kết quả không phải boolean thì được mang động từ.
`checkEligible` trả về những hạng đã đạt — nó làm việc thật, và nó **không** vi phạm mã này.

Vì sao là "tính chất bền" chứ không chỉ "tính chất": một câu hỏi đúng dạng nhưng hỏi về thứ tạm bợ
(`isCurrentlyInBatch`) sẽ chết cùng thứ tạm bợ đó. Câu hỏi phải hỏi về thứ còn sống sau lần thay đổi kế
tiếp.

**Tình huống nghiệp vụ hay gặp.** Kiểm tra đã ghi danh chưa · kiểm tra còn hạn gói cước · kiểm tra đã
bật seeder chưa · kiểm tra có nội dung trong snapshot chưa · kiểm tra quyền của một vai trò.

## `NAME-7` — tên nói capability, không nói người gọi đầu tiên

**Tình huống.** Một capability dùng chung được đặt tên theo **bề mặt đầu tiên yêu cầu nó**:
`DashboardContentService`.

**Nó sinh ra gì trong source.** Một symbol mang tên capability ở tầng dùng chung — `streak`, `loyalty`,
`progress`, `user` — còn chữ chỉ bề mặt chỉ xuất hiện trong đường dẫn operation theo bề mặt gọi tới nó.

**Dấu hiệu nhận biết.** Trong tên một service dùng chung có tên một màn hình, một trang, một tab. Nó nằm
ở tầng dùng chung nhưng chỉ có đúng một nơi gọi — hiện tại. Ngày có nơi gọi thứ hai, nó **vẫn chạy** và
**vẫn nói sai**.

**Ranh giới.** Không phải `NAME-1`: một thư mục operation **theo bề mặt** là phạm vi hợp lệ của chính
operation đó; cái bị cấm là mang tên bề mặt sang một service dùng chung. Không phải ngoại lệ: nếu chữ
trông giống tên người gọi thật ra **là khái niệm nghiệp vụ** — một read model dựng riêng cho đúng bề mặt
ấy — thì nó đang gọi tên chính nó, không phải gọi tên bên yêu cầu đầu tiên.

Vì sao mã này khó thấy nhất: sáu mã kia sai vì một thứ đã **đổi**. Mã này sai vì một thứ được **thêm
vào**, và thêm vào thì không ai đi đọc lại tên cũ.

**Tình huống nghiệp vụ hay gặp.** Service tổng hợp số liệu ban đầu chỉ có một trang dùng · helper định
dạng ban đầu chỉ có một email dùng · projection ban đầu chỉ có một widget đọc · query builder ban đầu
chỉ có một tab gọi.

## Tầng giữ

Không có tầng ứng dụng nào sở hữu việc đặt tên, và cũng không có tầng nào được phép không biết đến nó —
tầng nào cũng khai báo symbol. Cái được ghi lại ở đây là **hạng** thật sự giữ từng mã:
`unrepresentable` nghĩa là một union đóng hoặc branded type làm cho giá trị sai không viết ra được;
`enforced` nghĩa là một lint rule trong `@starci/eslint-canon-be` bắt được; `documented` nghĩa là không có
gì máy móc giữ nó, chỉ có người đọc.

| Mã | Hạng | Cái gì giữ nó |
|---|---|---|
| `NAME-1` | `documented` | — |
| `NAME-2` | `enforced` | `no-version-in-name` (export `noVersionInName`) |
| `NAME-3` | `documented` | — |
| `NAME-4` | `documented` | — |
| `NAME-5` | `enforced` | `no-bare-verb-export` (export `noBareVerbExport`) |
| `NAME-6` | `documented` | — |
| `NAME-7` | `documented` | — |

**Hai mã enforced, năm mã documented, không mã nào unrepresentable.** Cột `unrepresentable` trống là do
cấu trúc chứ không phải bỏ sót: một identifier không phải một giá trị, nên không union đóng hay branded
type nào làm cho một identifier tệ trở nên không viết được. `isV2` là TypeScript hợp lệ ở đúng mọi vị
trí `hasVerifiedMarker` hợp lệ, và compiler không có ý kiến gì về việc cái nào nói thật. Đó chính là lý
do module này tồn tại dưới dạng văn xuôi.

Hai dòng enforced cũng là hai dòng hẹp nhất. `no-version-in-name` chỉ đi qua các declaration — function,
class, interface, type alias, method — và không đi qua biến hay property, nên một cái tên có số đời viết
dưới dạng `const` cục bộ vẫn lọt. `no-bare-verb-export` khớp một danh sách đóng gồm mười tám động từ,
nên một động từ trần nằm ngoài danh sách đó vẫn lọt. Cả hai khoảng hở đều có thật: một bảng hạng làm
tròn "một phần" thành "enforced" chính là kiểu nói dối mà luật này nói tới. Mọi dòng `documented` vẫn là
rủi ro còn mở, do người đọc giữ và không do gì khác giữ.

## Điểm neo

Mã thật để đối chiếu từng luật. Một luật không chỉ được vào đâu thì chỉ là một đề xuất.

| Mã | Điểm neo | Nhìn cái gì |
|---|---|---|
| `NAME-1` | `modules/platform/event/nats/producer.service.ts` · `modules/platform/event/nats/nats-bridge.service.ts` | Hai file trong một folder. File đầu chỉ gọi tên chủ thể và khai báo `NatsProducerService` — folder cộng file đọc liền nhau. File sau lặp chữ của folder ngay trong tên file và khai báo `NatsBridgeService`, nói "nats" hai lần cho cùng một tên class |
| `NAME-1` | `modules/init/seeders/courses/path/content.service.ts` · `modules/init/seeders/courses/parsers/content.service.ts` | Đúng cặp mà luật này được viết ra từ đó: tên file giống hệt nhau, folder khác nhau, khai báo `ContentPathService` và `ContentParserService`. Đây là lý do file không được gọi là `content-parser.service.ts` |
| `NAME-1` | `features/api/core/graphql/mutations/ai/purchase-ai-subscription/` | Mọi hậu tố file đều khớp vai trò của export — `.handler.ts` khai báo một `*Handler`, `.resolver.ts` một `*Resolver`, `.module.ts` một `*Module` — và không file nào lặp lại vai trò của folder operation trong tên file |
| `NAME-2` | `features/api/processors/ai/shared/project-evaluation/project-evaluation-prompt.service.ts` → `ProjectEvaluationV2PromptInput` | Một interface đang sống mà lint rule sẽ báo ngay hôm nay. Đọc nó rồi hỏi "V2" nói gì với một người không biết có tồn tại V3 hay không |
| `NAME-2` | `features/api/processors/ai/review-milestone-task/steps/review-milestone-task-grade-step.service.ts` → `const isV2Task = Boolean(milestoneTask.verified)` | Cái tên nói một đời schema trong khi biểu thức ngay bên cạnh nói ra tính chất, `verified`. Đây cũng đúng là dạng mà rule không đi qua, nên nó là điểm neo cho cả luật lẫn khoảng hở enforcement |
| `NAME-3` | `tests/helpers/git-mount.ts` → `readGitMountDoc`, `GitMountDoc`, và block comment phía trên `MOUNT_DATA` | Cái tên đã sửa cùng bản ghi nó được sửa từ đâu: một mount đổi tên hai lần, các helper giữ nguyên tên đầu tiên suốt cả hai lần, và một skip-gate biến đường dẫn không còn tồn tại thành một lần chạy xanh |
| `NAME-4` | `modules/ai/utils/compute-model-weight.ts` · `modules/ai/utils/credit-for-typical-call.ts` | Tên lấy từ thứ được tính — một trọng số model, phần credit một lời gọi điển hình tiêu tốn — chứ không lấy từ cách sắp xếp định tuyến đang tiêu thụ chúng. Bộ trọng số sống sót qua một lần đổi roster; một cái tên dựng trên cách định tuyến thì đã không |
| `NAME-5` | `modules/ai/utils/` → `computeModelWeight`, `estimateUsdPerCall`, `resolveGradingChain`, `creditForTypicalCall` | Bốn export, bốn tân ngữ. `resolveGradingChain` là cái đáng chú ý: `resolve` nằm trong danh sách động từ trần của rule mà vẫn qua, vì mã này cấm một động từ trần, không cấm một động từ |
| `NAME-5` | `tests/helpers/judge.ts` → `export const judge` | Một export mang dạng động từ trần mà danh sách từ đóng của rule không chứa. Đọc nó như ranh giới của phần enforcement, không phải ranh giới của luật |
| `NAME-6` | `modules/init/scope/seed-scope.service.ts` → `isSeedersEnabled`, `isCoursesSeederEnabled` · `modules/init/data-git/data-git.service.ts` → `hasContent` | Những câu hỏi về tính chất còn sống lâu hơn lý do chúng được thêm vào |
| `NAME-6` | `modules/bussiness/user/user.service.ts` → `checkEnrollment` · `modules/bussiness/achievements/badges/abstract-badge.ts` → `checkEligible` | Cả hai đều bắt đầu bằng `check`, và chỉ cái đầu là finding: spec của nó assert `toBe(true)`, tức nó trả lời một câu hỏi và phải nói `is`. `checkEligible` trả về những hạng đã đạt, nên nó thật sự làm việc và đúng là không phải một câu hỏi boolean |
| `NAME-7` | `modules/bussiness/` · `features/api/core/graphql/queries/dashboard/active-advertisement/active-advertisement.resolver.ts` | Tầng dùng chung được đặt tên theo capability xuyên suốt — `streak`, `loyalty`, `progress`, `user` — không service nào mang tên một bề mặt. Chữ chỉ bề mặt chỉ xuất hiện trong đường dẫn operation theo bề mặt, và resolver ở đó gọi tới một `UserService` mang tên capability. Chính sự bất đối xứng đó là mã này, đã được hiện hình |

Mọi mã đều đã có neo. Không mã nào ghi "chưa neo được".

## Đầu vào

| Đầu vào | Bằng chứng cần có |
|---|---|
| subject | Chính vật đó, phát biểu mà không tham chiếu đến một đời schema, một path, một cơ chế hay một người gọi |
| role | Service, handler, resolver, module, util, constant — và hậu tố file khai báo vai trò ấy |
| scope | Thư mục symbol đứng dưới, và từ nào trong đó là vai trò, từ nào là chủ thể |
| return | Với một predicate: kiểu trả về đã khai báo, vì nó quyết định giữa một câu hỏi và một thao tác |
| callers | Mọi bề mặt đang gọi nó, và mọi bề mặt hợp lý sẽ gọi nó |
| durability | Lần thay đổi hợp lý kế tiếp, và cái tên có sống sót qua đó không |

## Quy tắc

1. Hậu tố file đồng ý với vai trò của thứ nó export.
2. Path mang vai trò và phạm vi; tên file chỉ thêm chủ thể.
3. Không identifier nào gói vào một đời schema, một thư mục, một mount hay một cơ chế.
4. Một hàm export gọi tên tân ngữ của nó.
5. Boolean là một câu hỏi, và câu hỏi ấy hỏi về một tính chất bền.
6. Một capability không bị định ngữ hoá theo bề mặt nào yêu cầu nó đầu tiên.
7. Một cái tên buộc phải đổi vì một thay đổi lường trước được thì chưa từng đặt tên cho vật.
8. Mọi symbol được khai báo đều giải về đúng một mã. Không symbol nào nằm ngoài phạm vi.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ đều đóng và nêu rõ mã nó áp vào.

- **Cơ chế chính là chủ thể** (`NAME-4`). Mã này không đụng tới một module integration mà toàn bộ việc
  của nó là một hệ thống ngoài: một client cho một broker thì mang tên broker, vì đó đúng là thứ người
  đọc đang tìm. Cái bị từ chối là đặt tên một capability NGHIỆP VỤ theo hạ tầng nó đang cưỡi.
- **Phiên bản chính là giá trị** (`NAME-2`). Mã này không đụng tới một field, một cột hay một hằng số
  mô hình hoá phiên bản như dữ liệu — một `schemaVersion` được lưu, một đoạn đường dẫn API public, một
  class migration mà danh tính chính là số thứ tự. Những cái đó gọi tên một **giá trị**; `isV2` gọi tên
  một nhánh.
- **Thư mục chính là chủ thể** (`NAME-1`). Mã này chấp nhận một chữ bị lặp khi chữ của folder là chủ thể
  chứ không phải vai trò — một file module khai báo module của đúng thư mục nó gọi tên thì không còn tên
  nào khác để mang.
- **Động từ trần trong phạm vi file** (`NAME-5`). Mã này quản EXPORT. Một helper private đọc cách thân
  hàm ba dòng thì được là động từ trần; đúng lúc nó được export ra, nó phải có tân ngữ.
- **Bề mặt chính là miền nghiệp vụ** (`NAME-7`). Mã này không nổ khi chữ trông giống tên người gọi thật
  ra là khái niệm nghiệp vụ — một read model theo bề mặt thì gọi tên bề mặt ấy một cách chính đáng, vì
  bề mặt là **cái nó là**, không phải người đã hỏi.

## Đầu ra

Mỗi file mà shape đã duyệt sinh ra là một khối.

```text
symbol: <the declared name>
path: <folder/file>
role: <service | handler | resolver | module | util | constant | predicate>
situation: <NAME-1 … NAME-7>
subject: <what the name is about>
reason: <the foreseeable change the name survives, and the substitute it refused>
```

## Ví dụ đã giải

**Shape đã duyệt.** Một capability dùng chung đọc các tài liệu nội dung đã seed hiện nằm sau một git
mount, một predicate của seed scope nói seeder có đang bật không, và một bề mặt dashboard phơi ra một
lượt đọc quảng cáo qua đúng một operation GraphQL query.

```text
symbol: readGitMountDoc
path: src/tests/helpers/git-mount.ts
role: util
situation: NAME-3
subject: the mount document being read
reason: survives the storage directory being renamed again — it already has been, twice; refused readVolumeDoc, the address the thing currently sits behind. Not NAME-4, because the mount is where the document sits, not the mechanism that produces it
```

```text
symbol: isSeedersEnabled
path: src/modules/init/scope/seed-scope.service.ts
role: predicate
situation: NAME-6
subject: whether seeding is enabled
reason: survives as a yes/no question about a property that outlives the reason it was added; refused checkSeeders, which reads as performing the check, and seedersFlag, which names nothing. Not NAME-2, because the question is about a property and not about a schema generation
```

```text
symbol: ActiveAdvertisementResolver
path: src/features/api/core/graphql/queries/dashboard/active-advertisement/active-advertisement.resolver.ts
role: resolver
situation: NAME-1
subject: the active advertisement read for this operation
reason: the path carries role and scope, the file adds only the subject, and the .resolver.ts suffix agrees with the exported role; refused repeating the operation folder's role inside the file name. Not NAME-7, because "dashboard" here is the per-surface operation path, which is a legitimate scope for the operation itself
```

```text
symbol: UserService
path: src/modules/bussiness/user/user.service.ts
role: service
situation: NAME-7
subject: the shared user capability
reason: survives a second surface calling it tomorrow; refused DashboardUserService, the first caller as qualifier. Not NAME-1, because the surface word is not this folder's role or scope — the shared layer is named by capability and the surface word belongs only in the operation path
```

**Shape không nói gì, nên không giải quyết gì.** Nó không nói các tài liệu nội dung đang ở đời nào, nên
không identifier nào ở đây được mang một số đời — đó là một quyết định `NAME-2` mà shape chưa hề đưa ra.
Nó không nói cơ chế nào đi lấy dữ liệu từ mount, nên không cái tên nào được dựng trên cơ chế đó
(`NAME-4`). Nó không nói sẽ có bao nhiêu bề mặt gọi capability dùng chung, và đó đúng là lý do `NAME-7`
gọi tên capability thay vì gọi tên nơi gọi duy nhất đang có hôm nay.

## Phạm vi

Quy tắc này đúng cho bất kỳ mã back-end nào cùng loại trong stack này — bất kỳ symbol nào được đọc ở call
site trước khi được mở ra. Nó không gọi tên một feature nào: ví dụ là TypeScript thường trong một ứng
dụng dạng NestJS, không gọi tên sản phẩm, không gọi tên repository, không gọi tên khoá học nào. Hai rule
id là hai danh từ riêng duy nhất trong bản thân luật, vì một rule id là một danh tính enforcement và một
rule bị đổi tên thì không trích dẫn được trong config. Đường dẫn repository chỉ xuất hiện ở phần Điểm neo
và không xuất hiện ở đâu khác — một điểm neo bắt buộc phải là một đường dẫn có thật, và đó chính là thứ
làm nó thành điểm neo.
