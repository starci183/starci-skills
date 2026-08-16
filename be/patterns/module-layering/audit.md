---
id: be-patterns-module-layering-audit
title: audit.md
slug: /be/patterns/module-layering/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, mức được giữ thật và khả năng neo vào code thật của luật module layering.
---

# audit.md

> Version: `2.00` · Module: `module-layering`

Audit này kiểm hai thứ. Một: luật có chọn được **một** đường đi từ dữ kiện đã nêu, và chỉ từ đó. Hai:
mỗi mã đang được giữ ở **tầng nào thật sự** — chứ không phải tầng mà bảng muốn nó thuộc về.

## Verdict

Chấp nhận, với ba mã ở tầng `documented` được nói thẳng thay vì làm tròn lên.

Năm mã đóng, tổng quát, không phụ thuộc tên sản phẩm hay tên repository nào. Phép thử chốt — *bê file
này sang repository khác cùng với capability của nó, còn đọc được không?* — trả lời được cả năm mã
mà không cần thêm dữ kiện nào ngoài đường dẫn của file và specifier.

Điểm yếu thật nằm ở chỗ khác: **hai mã có rule, ba mã chỉ có người đọc**, và hai rule đang có thì hẹp
hơn luật theo những cách cụ thể, đo được, liệt kê bên dưới.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `LAYERING-1` vs `LAYERING-2` | Loại trừ được: một mã hỏi specifier **dừng ở đâu**, mã kia hỏi specifier **có được là alias không** |
| `LAYERING-1` vs `LAYERING-5` | Loại trừ được khi đã nêu lỗi thuộc về **dòng của bên gọi** hay **file bên bị gọi dựng sẵn** |
| `LAYERING-2` vs `LAYERING-3` | Loại trừ được: một mã nói về specifier trong một file, mã kia nói về cạnh giữa hai `@Module` |
| `LAYERING-3` ngang vs xuống | Loại trừ được bằng một dữ kiện quan sát được: module bị import có nằm trong thư mục của capability đang import không |
| `LAYERING-3` vs `LAYERING-4` | Loại trừ được khi đã nêu có **hai** capability dính nhau hay chỉ **một** capability nói thay ứng dụng |
| `LAYERING-4` vs `LAYERING-5` | Loại trừ được khi đã nêu dữ kiện nói về **toàn cảnh ứng dụng** hay về **bề mặt một capability** |
| Capability vs category folder | Loại trừ được **chỉ khi** danh sách category folder là đúng và đầy đủ — xem "Rủi ro còn mở" |
| Thiếu dữ kiện đường dẫn của file nguồn | Không phân định được `LAYERING-1` với `LAYERING-2`. Đây là dữ kiện bắt buộc, không phải mặc định an toàn |

## Findings

- Trục "gọn hay dài", "quen hay lạ" đã bị loại khỏi tập tiêu chí. Cả năm mã chỉ đọc: đường dẫn file
  nguồn, specifier, và loại cạnh.
- Cạnh **xuống** được tách khỏi cạnh **ngang** một cách tường minh. Nếu không tách, `LAYERING-3` sẽ
  cấm luôn việc lắp ráp một capability, và mọi aggregator hợp lệ sẽ bị đọc thành vi phạm.
- `LAYERING-1` và `LAYERING-5` là **một sự thật nhìn từ hai đầu dây**. Có thể lập luận gộp chúng làm
  một. Đã **không** gộp: mã giữ nguyên số và nguyên nghĩa. Lý do giữ tách nằm trong `INDEX.md` —
  chúng hỏng ở hai thời điểm khác nhau và do hai người khác nhau sửa. Đây là một bất đồng được ghi
  lại, không phải một lần sửa im lặng.
- Hai rule đang có đều **hẹp hơn luật**, và hẹp theo cùng một hướng: chúng đọc một specifier đối chiếu
  với một filename, và không thấy gì khác.
  - `must-deep-module-import` chỉ soi ba alias của repository. Một specifier **tương đối** trỏ vào một
    thư mục (`from "./gateways"`) là barrel theo luật và **vô hình** với rule.
  - `no-self-module-alias` phải biết file nguồn thuộc capability nào, và nó biết bằng cách tách đường
    dẫn theo một **danh sách cố định** các category folder.
- **Danh sách category folder là chỗ hỏng có thật, không phải giả định.** Rule biết ba tên
  (`platform`, `lib`, `integrations`). Cây nguồn tham chiếu có ít nhất hai chỗ nữa hành xử đúng như
  category folder mà rule không biết:
  - `databases/` chứa các capability (`postgresql`, `qdrant`, `scylladb`). Vì rule không biết,
    `@modules/databases/postgresql` được đọc là "capability + file" và **lọt**, dù nó không chạm tới
    file nào.
  - `lib/native/` là category **lồng trong** category. Rule chỉ xử lý một tầng, nên
    `@modules/lib/native/redis` cũng lọt vì lý do y hệt.
  Cả hai đều là lỗ **bỏ sót**, không phải lỗi tố nhầm — nên chúng không tạo ra công việc giả, nhưng
  chúng làm bảng `Tầng giữ` chỉ đúng "phần lớn" ở hai hàng `enforced`.
- `LAYERING-3` **có** được giữ bằng máy trong cây tham chiếu, nhưng bằng một rule **viết tay trong
  repository**, glob theo `src/modules/**/*.module.ts` và `src/features/**/*.module.ts`, với
  `apps/*/src/**` cố tình để ngoài. Đó đúng là hình dạng mà nguồn canon nói phải port. Bảng `Tầng
  giữ` **không** ghi nó là `enforced`, vì tầng đó được định nghĩa theo rule của canon, và canon không
  publish rule này. Đây là chỗ dễ đọc nhầm nhất của phiên bản này.
- Cùng cái gate đó ghi lại một quyết định thật đáng giữ: một đăng ký **mang cấu hình per-instance
  thật** không bị tính là vi phạm, vì có những cấu hình không diễn đạt được bằng một lần đăng ký
  global. Quyết định đó thuộc về **gate của repository**, không thuộc luật này, nên nó nằm ở đây chứ
  không nằm trong `Ngoại lệ` của `INDEX.md`.
- `LAYERING-5` đang được giữ trong cây tham chiếu bằng **sự vắng mặt**: không có `index.ts` nào trong
  toàn bộ `src/`. Cộng với `paths` chỉ map `@modules/*`, một specifier dạng barrel thậm chí không
  resolve được. Đó là điều kiện **mạnh** — nhưng nó là một trạng thái, không phải một cơ chế: nó biến
  mất ngay lần đầu ai đó tạo một `index.ts`.

## Decisions

- Giữ đúng năm mã: `LAYERING-1`, `LAYERING-2`, `LAYERING-3`, `LAYERING-4`, `LAYERING-5`. Số và nghĩa
  giữ nguyên như file luật phẳng, vì chúng đang được trích dẫn từ nơi khác.
- Giữ mọi quyết định của luật phẳng: barrel bị từ chối, alias tự trỏ bị từ chối, cạnh ngang lên root,
  cạnh xuống được giữ, root độc quyền kiến thức toàn cảnh, bề mặt là tập file chứ không phải index.
- Ghi tầng giữ **theo sự thật đo được**: hai `enforced`, ba `documented`, không có
  `unrepresentable`.
- Không ghi rule viết tay của repository vào cột `enforced`. Nó là enforcement thật, nhưng không phải
  của canon; ghi nhầm sẽ khiến một repository adopting luật này tưởng mình được bảo vệ trong khi
  không.
- Neo cả năm mã vào đường dẫn thật. Không mã nào ghi `chưa neo được`.
- Giữ mọi ví dụ ở dạng TypeScript/NestJS tổng quát, không tên sản phẩm; đường dẫn repository chỉ xuất
  hiện trong bảng `Anchor`.

## Rủi ro còn mở

### `LAYERING-3` — `documented`

**Rule sẽ phải NHÌN THẤY được gì.** Phải trả lời được: "module đang bị import có nằm trong cây thư mục
của capability đang import không?" Đó là câu hỏi về **đồ thị module**, không phải về một file. Cụ thể,
một gate giữ được mã này phải:

1. Phân giải specifier trong `imports:` thành **đường dẫn file** thật (qua `paths` của tsconfig).
2. Xác định capability của **cả hai** đầu, dùng đúng danh sách category folder.
3. So sánh hai capability, và **loại trừ** trường hợp đích nằm bên dưới nguồn (cạnh xuống).
4. Loại trừ luôn mọi file nằm dưới composition root.

Một rule ESLint đọc từng file một **không** làm được bước 1 và 3 một cách đáng tin. Làm được nếu là
một gate **đi cả cây** — đó là hình dạng mà nguồn canon yêu cầu, và là hình dạng rule viết tay trong
cây tham chiếu đang có. Việc còn nợ là **đưa rule đó lên canon**, đúng luật "rule được viết ở một chỗ
và nhân bản đi".

**Rủi ro khi chưa làm.** Một repository adopting luật này sẽ đọc `LAYERING-3` như lời khuyên, và
cạnh ngang đầu tiên sẽ vào cây mà không có gì đỏ lên. Đây là mã tốn nhiều công nhất để gỡ về sau: gỡ
mười bảy cạnh ngang trong cây tham chiếu cần **ba quyết định thật**, không phải mười bảy lần xoá dòng.

### `LAYERING-4` — `documented`

**Rule sẽ phải NHÌN THẤY được gì.** Hai nửa, và chỉ một nửa khả thi.

- Nửa khả thi: "một `@Module` **ngoài** composition root có tự đặt `global: true` cho chính nó
  không?" Đây là một mẫu cú pháp trong một file, glob theo đường dẫn — viết được ngay, và nên viết.
- Nửa **không** khả thi: "kiến thức về thứ tự khởi động có đang nằm trong một capability không?" Thứ
  tự khởi động biểu hiện dưới dạng *một import side-effect phải đứng trước*, *một `forRoot` phải chạy
  trước một `register`*, *một comment nói "phải nạp trước X"*. Không có mẫu cú pháp nào phân biệt
  được một side-effect import **bắt buộc phải đứng đầu** với một side-effect import bình thường. Dữ
  kiện quyết định — *thứ tự này có quan trọng không* — chỉ tồn tại trong đầu người viết và trong
  comment cạnh nó.

**Vì sao không rule nào giữ nổi nửa sau.** Vì thứ bị cấm không phải một cấu trúc, mà một **loại kiến
thức**. Kiến thức không có hình dạng cú pháp riêng.

### `LAYERING-5` — `documented`

**Rule sẽ phải NHÌN THẤY được gì.** Mã này là mã dễ giữ nhất trong ba mã, và đang bị bỏ trống.

Một rule đủ giữ nó chỉ cần: với mỗi file trong `src/**`, nếu **mọi** khai báo top-level của nó đều là
`ExportNamedDeclaration` hoặc `ExportAllDeclaration` **có `source`** — tức là nó chỉ chuyển tiếp,
không khai báo gì — thì báo lỗi. Không cần đồ thị, không cần phân giải đường dẫn, không cần biết
capability nào. Đây là một rule một-file, rẻ và chính xác, đúng loại rule được phép để ở `error`.

Bổ sung thứ hai, cũng rẻ: cấm hẳn tên file `index.ts` trong `src/modules/**` và `src/features/**`.
Thô hơn, nhưng nó chặn đúng cái tên mà công cụ tự động phân giải, và nó không cần đọc nội dung file.

**Vì sao chưa có.** Trong cây tham chiếu, con số hiện tại là **không có `index.ts` nào**, nên rule sẽ
land ở nợ bằng không ngay lập tức. Nói cách khác, mã này đang được giữ bởi một **trạng thái may mắn**
chứ không bởi một cơ chế, và trạng thái đó mất ngay lần đầu ai đó tạo file. Đây là khoản nợ **rẻ
nhất** trong ba khoản.

### Hai hàng `enforced` cũng chưa kín

- **Danh sách category folder cứng và thiếu.** `databases/` và `lib/native/` hành xử như category
  folder mà rule không biết, nên barrel dưới hai đường đó lọt qua cả `LAYERING-1` lẫn `LAYERING-2`.
  Cách sửa đúng **không phải** thêm hai chuỗi vào danh sách — đó là cách nó sai lần sau. Cách sửa là
  suy ra tính chất "thư mục này chứa capability chứ không phải là capability" từ chính cây thư mục:
  một thư mục không chứa file nguồn nào ở tầng đầu tiên của nó thì là category folder.
- **Barrel bằng đường tương đối vô hình.** `must-deep-module-import` chỉ soi alias. Nếu rule
  `LAYERING-5` đề xuất bên trên được viết, lỗ này tự đóng — vì lúc đó **không còn barrel nào để
  import**, dù bằng alias hay bằng `./`.

### Bất đồng được ghi lại

- **`LAYERING-1` và `LAYERING-5` có thể bị coi là một mã.** Chúng nói cùng một sự thật từ hai đầu.
  Mã **không** bị gộp và **không** bị đánh số lại: số mã đang được trích dẫn từ luật anh em và từ
  task record cũ, nên gộp là bẻ gãy một trích dẫn ai đó đã viết. Nếu về sau thấy việc tách thật sự
  gây nhầm, đó là một đề xuất **rule change** ghi vào `changelog.md`, không phải một lần chọn khác đi.

## Re-audit Triggers

- Có đề xuất thêm, bớt hoặc đánh số lại một mã `LAYERING-<n>`.
- Xuất hiện một `index.ts` hoặc một file chỉ chuyển tiếp export ở bất kỳ đâu trong `src/**`.
- Xuất hiện một thư mục **chứa** capability mà danh sách category folder của rule chưa biết.
- Một `@Module` ngoài composition root tự đặt `global: true`.
- Một capability xuất hiện import side-effect có ràng buộc thứ tự.
- Rule cạnh-ngang được port lên canon — lúc đó hàng `LAYERING-3` trong bảng `Tầng giữ` phải đổi.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm hoặc một module riêng mới đọc được.
